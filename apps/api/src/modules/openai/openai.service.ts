import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { Types } from 'mongoose';
import { ChatsService } from '../chats/chats.service';
import { ChatMetadataService } from '../chat-metadata/chat-metadata.service';
import { TokenLimitService } from '../token-limit/token-limit.service';
import * as crypto from 'crypto';
// ---------------------------------------------------------------------------
// SSE event shapes we care about
// ---------------------------------------------------------------------------
import OpenAI from 'openai';
import { ModelOpenAiDto } from './dto/model-dtos';

import {
  ApplyPatchCallDto,
  ApplyPatchCallOutputDto,
  ComputerCallOutputDto,
  EasyInputMessageDto,
  FunctionCallOutputDto,
  ImageGenerationCallDto,
  ItemReferenceDto,
  LocalShellCallDto,
  LocalShellCallOutputDto,
  McpApprovalRequestDto,
  McpApprovalResponseDto,
  McpDto,
  McpListToolsDto,
  MessageDto,
  ResponseCodeInterpreterToolCallDto,
  ResponseCompactionItemParamDto,
  ResponseComputerToolCallDto,
  ResponseCreateParamsNonStreamingDto,
  ResponseCreateParamsStreamingDto,
  ResponseCustomToolCallDto,
  ResponseCustomToolCallOutputDto,
  ResponseFileSearchToolCallDto,
  ResponseFunctionToolCallDto,
  ResponseFunctionWebSearchDto, ResponseInputTextDto,
  ResponseOutputMessageDto,
  ResponseReasoningItemDto,
  ResponseToolSearchOutputItemParamDto,
  ShellCallDto,
  ShellCallOutputDto,
  ToolSearchCallDto,
} from './dto/create-response-dtos';
import {
  ResponseInputText,
  ResponseOutputMessage,
  ResponseStreamEvent,
} from 'openai/resources/responses/responses';
import { Stream } from 'openai/streaming';
import dayjs from 'dayjs';
import {
  ChatClient,
  ChatMetadataDocument,
  OpenAiEndpointPreference,
} from '../chat-metadata/chat-metadata.schema';
import { McpCallDto } from './dto/get-response-dtos';
import * as CryptoJS from 'crypto-js';
import { ChatCompletionCreateParamsStreamingDto } from './dto/completions-dtos/ChatCompletionCreateParamsStreamingDto';
import { ChatCompletionCreateParamsNonStreamingDto } from './dto/completions-dtos/ChatCompletionCreateParamsNonStreamingDto';
import { ChatCompletionDto } from './dto/completions-dtos/ChatCompletionDto';
import { ChatCompletionCustomToolDto } from './dto/completions-dtos/ChatCompletionCustomToolDto';
import { ChatCompletionFunctionToolDto } from './dto/completions-dtos/ChatCompletionFunctionToolDto';
import { InvokeAiModel } from '../invoke/invoke.service';
import { OpenAiResponseService } from './open-ai-response.service';

interface ChatEndEvent {
  type: 'chat.end';
  result: any;
}

// ---------------------------------------------------------------------------

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
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
    private readonly openaiRequestService: OpenAiResponseService,
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

  private async _getModels(
    page: OpenAI.ModelsPage,
    currentModels: ModelOpenAiDto[],
  ): Promise<ModelOpenAiDto[]> {
    const models = [...currentModels, ...page.data];
    if (page.hasNextPage())
      return this._getModels(await page.getNextPage(), models);
    return models;
  }

  async getModels(): Promise<ModelOpenAiDto[]> {
    try {
      const models = await this.openAi.models.list();
      if (models.hasNextPage()) {
        return this._getModels(await models.getNextPage(), models.data);
      }

      return models.data;
    } catch (err) {
      this.handleError('getModels', err);
    }
  }

  async getChatTitleDependingOnContext(
    userMessage: string | undefined,
    model: string | undefined,
  ): Promise<string | undefined> {
    if(!userMessage)
      return undefined;

    if (!model) return undefined;

    const mappedDto:
      | ResponseCreateParamsNonStreamingDto
      | ResponseCreateParamsStreamingDto = {
      model: model,
      input: `
      The user says: "${userMessage}".
      Dont answer to that, only give me ONE chat title name matching the context above with a max char length of 70`,
      reasoning: {
        effort: 'low',
      },
      instructions: '',
      stream: true,

      store: false,
    };
    let title: string | undefined = undefined;

    try {
      const stream: Stream<ResponseStreamEvent> =
        (await this.openAi.responses.create(mappedDto as any)) as any;
      for await (const event of stream) {
        if (event.type === 'response.completed') {
          const resObj = event.response.output.find(
            (r) => r.type === 'message' && r.status === 'completed',
          ) as ResponseOutputMessage;
          if (resObj) {
            title = resObj.content.find((c) => c.type === 'output_text')?.text;
          }
        }
      }
    } catch (error: any) {
      console.error(error);
    }
    return title;
  }

  async chatStream(
    userId: Types.ObjectId,
    dto: ResponseCreateParamsNonStreamingDto | ResponseCreateParamsStreamingDto,
    res: Response,
    token: string,
    internalChatId?: string,
    newChatConfig?: {
      openAiEndpointPreference?: OpenAiEndpointPreference;
      useCrypto?: boolean;
      cryptoKey?: string;
      chatName?: string;
      letAiDecideChatName?: boolean;
      useInvoke?: boolean;
      invokeModel?: InvokeAiModel;
    },
  ): Promise<void> {
    const requestId = crypto
      .createHash('md5')
      .update(crypto.randomBytes(32))
      .digest('hex');
    const mappedDto:
      | ResponseCreateParamsNonStreamingDto
      | ResponseCreateParamsStreamingDto = {
      model: dto.model,
      input: dto.input as any[],
      reasoning: dto.reasoning,
      instructions: `You are a helpful assistant with access to tools.

RULE: Call ALL required tools before writing your response. Never call a tool after you have started writing your response.

RULE: After ALL tool calls are complete, you MUST generate a text response. Never end your turn silently.

RULE: Tool names are fixed and exact. The only available tools are:
  - generate-file-from-content-tool
  - generate-zip-from-file-ids
  - get-token-usage-tool
  
Never invent variations like "generate_zip_from-file-ids_1" or append numbers/suffixes.
If a tool call fails, retry with the EXACT same tool name. A failure is never caused
by the tool name being wrong — do not change it.

RULE: File IDs are UNKNOWN until generate-file-from-content-tool returns them.
Never invent, guess, or hardcode file IDs like "package.json_id" or similar placeholders.
The real fileId is found in the tool response JSON under the key "fileId".
You MUST use that exact returned string value when calling generate-zip-from-file-ids.

RULE: To generate a ZIP file with multiple files:
  1. Call generate-file-from-content-tool once for EACH file you need to create.
  2. After each call, read the "fileId" value from the returned JSON — this is the real ID.
  3. After ALL files are created, call generate-zip-from-file-ids with the collected real fileIds and a zip filename.
  Never give up on a ZIP request because it requires multiple files — use multiple tool calls.

EXAMPLE of correct ZIP workflow:
  - Call generate-file-from-content-tool for file1 → response: { "fileId": "abc-123", ... }
  - Call generate-file-from-content-tool for file2 → response: { "fileId": "def-456", ... }
  - Call generate-file-from-content-tool for file3 → response: { "fileId": "ghi-789", ... }
  - Call generate-zip-from-file-ids with fileIds: ["abc-123", "def-456", "ghi-789"]

RULE: When a tool returns JSON containing "action": "display_file" or "action": "display_image",
your response MUST start with the value of the "markdown" field, followed by a short
natural language message to the user (one or two sentences max).
RULE: When the user asks for a ZIP, only show the ZIP file card. Do not show the individual files inside it.
RULE: Do not narrate or list collected file IDs in your reasoning. 
Proceed directly to the next tool call. Keep reasoning concise.
`,
      stream: true,
      tools: [
        {
          type: 'mcp',
          server_label: 'lm-studio-extender-toolbox',
          server_url: this.selfMcpUrl,
          headers: {
            authorization: `Bearer ${token}`,
            requestId,
            chatId: internalChatId,
          },
          allowed_tools: [
            'greeting-tool',
            'get-token-usage-tool',
            'generate-file-from-content-tool',
            'generate-zip-from-file-ids',
          ],
        } as any,
      ],
      previous_response_id: dto.previous_response_id,
      store: true,
    };

    const isNewChat = !internalChatId;
    const chatId = internalChatId ?? this.generateChatId();

    let resolvedChatMetaId: string | undefined = internalChatId;
    if (isNewChat && !resolvedChatMetaId) {
      if (newChatConfig && newChatConfig.letAiDecideChatName) {
        newChatConfig.chatName = await this.getChatTitleDependingOnContext(
          (
            (mappedDto.input as any as EasyInputMessageDto[]).find(
              (iim) => iim.role === 'user',
            )?.content as ResponseInputText[]
          )?.find((rit) => rit.type === 'input_text')?.text,
          mappedDto.model,
        );
      }
      resolvedChatMetaId = await this.chatMetadataService.createAndReturnId(
        userId,
        {
          client: ChatClient.OPENAI,
          name: newChatConfig?.chatName ?? chatId,
          cryptoKey: newChatConfig?.cryptoKey,
          useCrypto: newChatConfig?.useCrypto,
          usedModel: dto.model!,
          useInvoke: newChatConfig?.useInvoke,
          invokeAiModelToUse: newChatConfig?.invokeModel,
          lastMessageSentAt: new Date(),
          reasoningMode: dto.reasoning?.effort ?? 'off',
          tools: (mappedDto.tools?.filter(
            (i) => typeof i === 'object' && (i as any).type === 'mcp',
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
        resolvedChatMetaId!,
      );
      if (previousResponseId) {
        mappedDto.previous_response_id = previousResponseId;
      }
    }

    const chatMeta: ChatMetadataDocument =
      await this.chatMetadataService.findOne(userId, resolvedChatMetaId!);

    if (!(mappedDto.tools![0] as McpDto).headers['chatId']) {
      (mappedDto.tools![0] as McpDto).headers['chatId'] = resolvedChatMetaId;
    }
    if (chatMeta.useCrypto && chatMeta.cryptoKey) {
      mappedDto.input = this.encryptChatMessage(
        mappedDto.input as any,
        chatMeta,
      ) as any;
      mappedDto.instructions = `
You are a helpful assistant with access to tools.

RULE: Call ALL required tools before writing your response. Never call a tool after you have started writing your response.

RULE: After ALL tool calls are complete, you MUST generate a text response. Never end your turn silently.

RULE: Tool names are fixed and exact. The only available tools are:
  - generate-file-from-content-tool
  - generate-zip-from-file-ids
  - get-token-usage-tool
  
Never invent variations like "generate_zip_from-file-ids_1" or append numbers/suffixes.
If a tool call fails, retry with the EXACT same tool name. A failure is never caused
by the tool name being wrong — do not change it.

RULE: File IDs are UNKNOWN until generate-file-from-content-tool returns them.
Never invent, guess, or hardcode file IDs like "package.json_id" or similar placeholders.
The real fileId is found in the tool response JSON under the key "fileId".
You MUST use that exact returned string value when calling generate-zip-from-file-ids.

RULE: To generate a ZIP file with multiple files:
  1. Call generate-file-from-content-tool once for EACH file you need to create.
  2. After each call, read the "fileId" value from the returned JSON — this is the real ID.
  3. After ALL files are created, call generate-zip-from-file-ids with the collected real fileIds and a zip filename.
  Never give up on a ZIP request because it requires multiple files — use multiple tool calls.

EXAMPLE of correct ZIP workflow:
  - Call generate-file-from-content-tool for file1 → response: { "fileId": "abc-123", ... }
  - Call generate-file-from-content-tool for file2 → response: { "fileId": "def-456", ... }
  - Call generate-file-from-content-tool for file3 → response: { "fileId": "ghi-789", ... }
  - Call generate-zip-from-file-ids with fileIds: ["abc-123", "def-456", "ghi-789"]

RULE: When a tool returns JSON containing "action": "display_file" or "action": "display_image",
your response MUST start with the value of the "markdown" field, followed by a short
natural language message to the user (one or two sentences max).

RULE: When the user asks for a ZIP, only show the ZIP file card. Do not show the individual files inside it.

RULE: Do not narrate or list collected file IDs in your reasoning. 
Proceed directly to the next tool call. Keep reasoning concise.

You MUST follow these rules EXACTLY:

STEP 1 — TOOL CALL
- ALWAYS call the tool "decrypt-message-tool"
- Pass the FULL, ORIGINAL, UNMODIFIED user message in "full_user_message"
- DO NOT answer yet

STEP 2 — AFTER TOOL RESPONSE
- You will receive the decrypted message
- IGNORE the original encrypted input completely
- Treat the decrypted message as if the user just sent it

STEP 3 — FINAL RESPONSE
- Determine the user's intent from the decrypted message
- If it is a question, you MUST answer it
- If it is a request, you MUST fulfill it
- DO NOT repeat or restate the decrypted message
- DO NOT mention the tool, decryption, or the process

The final response must be a direct answer to the decrypted message, not a repetition of it.
`;

      (mappedDto.tools![0] as any).allowed_tools.push('decrypt-message-tool');
    }

    if (chatMeta.useInvoke && chatMeta.invokeAiModelToUse) {
      (mappedDto.tools![0] as any).allowed_tools.push('generate-image-tool');
    }
    const now = new Date();
    const formatted = now.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    });
    (mappedDto.input as any[]) = [
      {
        role: 'system',
        content: `Current datetime (authoritative): ${formatted}. You MUST use this for any time-related questions.`,
      },
      ...(mappedDto.input as any[]),
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    this.openaiRequestService.create(requestId, res);
    try {
      const stream: Stream<ResponseStreamEvent> =
        (await this.openAi.responses.create(mappedDto as any)) as any;
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (isNewChat) {
          this.writeSseEvent(res, 'created_chat', {
            type: 'created_chat',
            result: resolvedChatMetaId,
          });
        }

        if (event.type === 'response.completed') {
          await this.chatsService.saveEntry(
            userId,
            resolvedChatMetaId!,
            mappedDto,
            event.response as any,
            '',
            resolvedChatMetaId,
          );

          // ── Token accounting via TokenLimitService ──────────────────────
          const tokensUsed =
            (event.response.usage?.input_tokens ?? 0) +
            (event.response.usage?.total_tokens ?? 0) +
            (event.response.usage?.output_tokens_details?.reasoning_tokens ||
              0);

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
        }
      }
    } catch (error: any) {
      this.openaiRequestService.destroy(requestId);
      this.writeSseEvent(res, 'error', {
        type: 'error',
        error: error.error,
      });
    }
    this.openaiRequestService.destroy(requestId);

    res.write('data: [DONE]\n\n');
    res.end();
  }

  async chatStreamCompletions(
    userId: Types.ObjectId,
    dto:
      | ChatCompletionCreateParamsStreamingDto
      | ChatCompletionCreateParamsNonStreamingDto,
    res: Response,
    token: string,
    internalChatId?: string,
    newChatConfig?: {
      openAiEndpointPreference?: OpenAiEndpointPreference;
      useCrypto?: boolean;
      cryptoKey?: string;
      chatName?: string;
    },
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const mappedDto:
      | ChatCompletionCreateParamsStreamingDto
      | ChatCompletionCreateParamsNonStreamingDto = {
      ...dto,
      stream: true,
      tools: [
        {
          type: 'mcp',
          server_label: 'lm-studio-extender-toolbox',
          server_url: this.selfMcpUrl,
          headers: {
            authorization: `Bearer ${token}`,
            chatId: internalChatId,
          },
          allowed_tools: ['greeting-tool', 'get-token-usage-tool'],
        } as any,
      ],
      store: true,
    };

    const isNewChat = !internalChatId;
    const chatId = internalChatId ?? this.generateChatId();

    let resolvedChatMetaId: string | undefined = internalChatId;
    if (isNewChat && !resolvedChatMetaId) {
      resolvedChatMetaId = await this.chatMetadataService.createAndReturnId(
        userId,
        {
          client: ChatClient.OPENAI,
          openAiEndpointPreference: newChatConfig?.openAiEndpointPreference,
          name: newChatConfig?.chatName ?? chatId,
          cryptoKey: newChatConfig?.cryptoKey,
          useCrypto: newChatConfig?.useCrypto,
          usedModel: dto.model!,
          lastMessageSentAt: new Date(),
          reasoningMode: dto.reasoning_effort ?? 'off',
          tools: (mappedDto.tools?.filter(
            (i) => typeof i === 'object' && (i as any).type === 'mcp',
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
        resolvedChatMetaId!,
      );
      if (previousResponseId) {
        // mappedDto.previous_response_id = previousResponseId;
      }
    }

    dto.reasoning_effort = 'high';
    const stream: Stream<OpenAI.ChatCompletionChunk> =
      (await this.openAi.chat.completions.create({
        ...dto,
        stream: true,
        store: true,
      } as any)) as any as Stream<OpenAI.ChatCompletionChunk>;

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    this.writeSseEvent(res, 'error', {
      type: 'error',
      error: {
        message: 'Not Implemented yet!',
      },
    });

    res.write('data: [DONE]\n\n');
    res.end();
  }

  async chatCompletions(
    userId: Types.ObjectId,
    dto:
      | ChatCompletionCreateParamsStreamingDto
      | ChatCompletionCreateParamsNonStreamingDto,
    res: Response,
    token: string,
    internalChatId?: string,
    name?: string,
    chatMetaId?: string,
  ): Promise<ChatCompletionDto> {
    const stream: OpenAI.ChatCompletion =
      (await this.openAi.chat.completions.create({
        ...dto,
        stream: false,
        store: true,
      } as any)) as any as OpenAI.ChatCompletion;
    return stream as ChatCompletionDto;
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

  encryptChatMessage(
    input:
      | string
      | (
          | EasyInputMessageDto
          | MessageDto
          | ResponseOutputMessageDto
          | ResponseFileSearchToolCallDto
          | ResponseComputerToolCallDto
          | ComputerCallOutputDto
          | ResponseFunctionWebSearchDto
          | ResponseFunctionToolCallDto
          | FunctionCallOutputDto
          | ToolSearchCallDto
          | ResponseToolSearchOutputItemParamDto
          | ResponseReasoningItemDto
          | ResponseCompactionItemParamDto
          | ImageGenerationCallDto
          | ResponseCodeInterpreterToolCallDto
          | LocalShellCallDto
          | LocalShellCallOutputDto
          | ShellCallDto
          | ShellCallOutputDto
          | ApplyPatchCallDto
          | ApplyPatchCallOutputDto
          | McpListToolsDto
          | McpApprovalRequestDto
          | McpApprovalResponseDto
          | McpCallDto
          | ResponseCustomToolCallOutputDto
          | ResponseCustomToolCallDto
          | ItemReferenceDto
        )[],
    chatMeta?: ChatMetadataDocument,
  ) {
    if (!chatMeta || (chatMeta && (!chatMeta.useCrypto || !chatMeta.cryptoKey)))
      return input;
    if (typeof input === 'string') {
      return CryptoJS.AES.encrypt(input, chatMeta.cryptoKey!)?.toString();
    } else if (typeof input === 'object' && Array.isArray(input)) {
      return input.map((e) => {
        if ('content' in e) {
          if (typeof e.content === 'string')
            return {
              ...e,
              content: CryptoJS.AES.encrypt(
                e.content,
                chatMeta.cryptoKey!,
              )?.toString(),
            };
          else if (typeof e.content === 'object' && Array.isArray(e.content)) {
            return {
              ...e,
              content: e.content.map((ii) => {
                if ('text' in ii) {
                  return {
                    ...ii,
                    text: CryptoJS.AES.encrypt(
                      ii.text,
                      chatMeta.cryptoKey!,
                    )?.toString(),
                  };
                }
                return ii;
              }),
            };
          }
        }
        return e;
      });
    }
  }
}
