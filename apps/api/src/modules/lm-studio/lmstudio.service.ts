import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { Response } from 'express';
import { Types } from 'mongoose';
import * as crypto from 'crypto';
import dayjs from 'dayjs';

import { ChatRequestDto } from './dto/chat.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ModelsResponseDto } from './dto/models-response.dto';
import { ChatsService } from '../chats/chats.service';
import { ChatMetadataService } from '../chat-metadata/chat-metadata.service';
import { TokenLimitService } from '../token-limit/token-limit.service';

// ---------------------------------------------------------------------------
// SSE event shapes we care about
// ---------------------------------------------------------------------------
import OpenAI from 'openai';
import { ChatClient } from '../chat-metadata/chat-metadata.schema';

interface ChatEndEvent {
  type: 'chat.end';
  result: ChatResponseDto;
}

// ---------------------------------------------------------------------------

@Injectable()
export class LmStudioService {
  private readonly logger = new Logger(LmStudioService.name);
  private readonly baseUrl: string;
  public readonly selfMcpUrl: string;
  private readonly apiToken: string;
  public readonly openAi: OpenAI;
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly chatsService: ChatsService,
    private readonly chatMetadataService: ChatMetadataService,
    private readonly tokenLimitService: TokenLimitService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'LM_STUDIO_BASE_URL',
      'http://localhost:1234',
    );
    this.apiToken = this.configService.get<string>('LM_STUDIO_API_TOKEN', '');

    this.openAi = new OpenAI({
      apiKey: this.apiToken,
      baseURL: this.baseUrl + '/v1',
    });

    this.selfMcpUrl = this.configService.get<string>(
      'SELF_MCP_URL',
      'http://192.128.0.34:8888/tools/mcp',
    );
  }

  /**
   * Expose userModel so the controller can still perform its own DB look-ups
   * (token-reset check). The model lives in TokenLimitService now.
   */
  get userModel() {
    return this.tokenLimitService.userModel;
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/models
  // ---------------------------------------------------------------------------

  async getModels(): Promise<ModelsResponseDto> {
    try {
      const response: AxiosResponse<ModelsResponseDto> = await firstValueFrom(
        this.httpService.get<ModelsResponseDto>(
          `${this.baseUrl}/api/v1/models`,
          { headers: this.authHeaders() },
        ),
      );
      return response.data;
    } catch (err) {
      this.handleError('getModels', err);
    }
  }

  // ---------------------------------------------------------------------------
  // POST /api/v1/chat
  // ---------------------------------------------------------------------------

  async chat(dto: ChatRequestDto): Promise<ChatResponseDto> {
    try {
      const response: AxiosResponse<ChatResponseDto> = await firstValueFrom(
        this.httpService.post<ChatResponseDto>(
          `${this.baseUrl}/api/v1/chat`,
          dto,
          { headers: this.authHeaders() },
        ),
      );
      return response.data;
    } catch (err) {
      this.handleError('chat', err);
    }
  }

  // ---------------------------------------------------------------------------
  // POST /api/v1/chat  (streaming)
  // ---------------------------------------------------------------------------

  async chatStream(
    userId: Types.ObjectId,
    dto: ChatRequestDto,
    res: Response,
    token: string,
    internalChatId?: string,
    name?: string,
    chatMetaId?: string,
  ): Promise<void> {
    dto.integrations = [
      {
        type: 'ephemeral_mcp',
        server_label: 'liquid-local-ai-client-toolbox',
        server_url: this.selfMcpUrl,
        headers: {
          authorization: `Bearer ${token}`,
        },
        allowed_tools: ['greeting-tool', 'get-token-usage-tool'],
      },
    ];

    const isNewChat = !internalChatId;
    const chatId = internalChatId ?? this.generateChatId();

    let resolvedChatMetaId: string | undefined = chatMetaId;
    if (isNewChat && !resolvedChatMetaId) {
      resolvedChatMetaId = await this.chatMetadataService.createAndReturnId(
        userId,
        {
          client: ChatClient.LMSTUDIO,
          name: name ?? chatId,
          usedModel: dto.model,
          reasoningMode: dto.reasoning ?? 'off',
          tools: (dto.integrations?.filter(
            (i) => typeof i === 'object' && (i as any).type === 'ephemeral_mcp',
          ) ?? []) as any,
        },
      );
    } else if (!isNewChat && resolvedChatMetaId) {
      await this.chatMetadataService.update(userId, resolvedChatMetaId, {
        lastMessageSentAt: new Date(),
      });
    }

    if (!isNewChat) {
      const previousResponseId = await this.chatsService.getLatestResponseId(
        userId,
        chatId,
      );
      if (previousResponseId) {
        dto.previous_response_id = previousResponseId;
      }
    }

    try {
      const axiosResponse = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/chat`,
          { ...dto, stream: true, store: true },
          {
            headers: this.authHeaders(),
            responseType: 'stream',
          },
        ),
      );

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const chunks: Buffer[] = [];

      axiosResponse.data.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        res.write(chunk);
      });

      axiosResponse.data.on('error', (err: Error) => {
        this.logger.error('Stream error', err);
        res.end();
      });

      axiosResponse.data.on('end', async () => {
        try {
          if (isNewChat) {
            this.writeSseEvent(res, 'created_chat', {
              type: 'created_chat',
              result: resolvedChatMetaId,
            });
          }

          const rawText = Buffer.concat(chunks).toString('utf8');
          const chatEndEvent = this.extractChatEndEvent(rawText);

          if (chatEndEvent) {
            await this.chatsService.saveEntry(
              userId,
              chatId,
              dto,
              chatEndEvent.result,
              name,
              resolvedChatMetaId,
            );

            // ── Token accounting via TokenLimitService ──────────────────────
            const tokensUsed =
              chatEndEvent.result.stats.input_tokens +
              chatEndEvent.result.stats.total_output_tokens +
              (chatEndEvent.result.stats.reasoning_output_tokens || 0);

            const updatedUser = await this.tokenLimitService.updateUsedTokens(
              userId,
              tokensUsed,
            );

            const limit = await this.tokenLimitService.getTokensPerIntervall(
              updatedUser.subscription,
            );

            if (updatedUser.usedTokens >= limit) {
              this.writeSseEvent(res, 'api.info', {
                type: 'api.info',
                message: `Rate limit reached. Resets at ${dayjs(updatedUser.tokenCountResetDate).toString()}`,
              });
            }
            // ───────────────────────────────────────────────────────────────
          } else {
            this.logger.warn(
              `No chat.end event found in stream for chatId=${chatId}`,
            );
          }
        } catch (persistErr) {
          this.logger.error('Failed to persist chat entry', persistErr);
        } finally {
          res.end();
        }
      });
    } catch (err) {
      this.handleError('chatStream', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private generateChatId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private writeSseEvent(
    res: Response,
    type: string,
    payload: Record<string, unknown>,
  ): void {
    res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  private extractChatEndEvent(rawText: string): ChatEndEvent | null {
    const lines = rawText.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const jsonStr = line.slice('data:'.length).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
        if (parsed.type === 'chat.end' && parsed.result) {
          return parsed as unknown as ChatEndEvent;
        }
      } catch {
        // not valid JSON — skip
      }
    }
    return null;
  }

  private authHeaders(): Record<string, string> {
    return this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {};
  }

  private handleError(method: string, err: unknown): never {
    this.logger.error(`[${method}] LM Studio request failed`, err);
    throw new InternalServerErrorException(
      `AI Model issue: ${(err as Error)?.message ? (err as Error)?.message : 'unknown'}`,
    );
  }
}
