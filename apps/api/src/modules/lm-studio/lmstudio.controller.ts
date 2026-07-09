import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { Response } from 'express';
import dayjs from 'dayjs';

import { LmStudioService } from './lmstudio.service';
import {
  ChatRequestDto,
  EphemeralMcpIntegrationDto,
  ImageInputDto,
  PluginIntegrationDto,
  TextInputDto,
} from './dto/chat.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ModelsResponseDto } from './dto/models-response.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/user.schema';
import { CurrentToken } from '../auth/current-token.decorator';
import { TokenLimitService } from '../token-limit/token-limit.service';

@ApiTags('LM Studio')
@ApiBearerAuth()
@ApiExtraModels(
  TextInputDto,
  ImageInputDto,
  PluginIntegrationDto,
  EphemeralMcpIntegrationDto,
)
@Controller('lmstudio')
export class LmStudioController {
  constructor(
    private readonly lmStudioService: LmStudioService,
    private readonly tokenLimitService: TokenLimitService,
  ) {}

  @Get('models')
  @ApiOperation({
    summary: 'List all available models (LLMs and embedding models)',
    operationId: 'getModels',
  })
  @ApiOkResponse({ type: ModelsResponseDto })
  getModels(): Promise<ModelsResponseDto> {
    return this.lmStudioService.getModels();
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a chat message to a locally loaded model',
    operationId: 'chat',
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiOkResponse({ type: ChatResponseDto })
  chat(@Body() dto: ChatRequestDto): Promise<ChatResponseDto> {
    return this.lmStudioService.chat(dto);
  }

  @Post('chat-stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stream a chat response via SSE',
    description:
      'Streams the LM Studio response as Server-Sent Events. ' +
      'Each exchange is persisted in MongoDB under the given `internalChatId`. ' +
      'If `internalChatId` is supplied, the latest `response_id` for that session ' +
      'is fetched from the DB and set as `previous_response_id` on the request ' +
      'so LM Studio maintains conversation context. ' +
      'If `internalChatId` is omitted a new session is created and its generated ' +
      'ID is returned via a `created_chat` SSE event before the stream closes.',
    operationId: 'chatStream',
  })
  @ApiQuery({
    name: 'internalChatId',
    required: false,
    description:
      'MD5 hex string identifying an existing chat session. ' +
      'Omit to start a new session.',
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Optional human-readable label for this chat session.',
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'Server-Sent Events stream. When no `internalChatId` was supplied, ' +
      'a synthetic `event: created_chat / data: {"type":"created_chat","result":"<md5>"}` ' +
      'event is emitted just before the stream closes.',
    schema: { type: 'string', format: 'binary' },
  })
  async chatStream(
    @CurrentUser() user: User,
    @CurrentToken() token: string,
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
    @Query('internalChatId') internalChatId?: string,
    @Query('name') name?: string,
  ): Promise<void> {
    const userId = (user as any)._id as Types.ObjectId;

    // ── Token window reset ──────────────────────────────────────────────────
    if (
      !user.tokenCountResetDate ||
      dayjs(user.tokenCountResetDate).isBefore(dayjs())
    ) {
      const updatedUser = await this.tokenLimitService.resetTokenLimit(userId);
      user.tokenCountResetDate = updatedUser.tokenCountResetDate;
      user.usedTokens = 0;
    }
    // ───────────────────────────────────────────────────────────────────────

    // ── Rate-limit enforcement ──────────────────────────────────────────────
    const limit = await this.tokenLimitService.getTokensPerIntervall(
      user.subscription,
    );

    if (user.usedTokens && user.usedTokens >= limit) {
      if (dayjs().isBefore(dayjs(user.tokenCountResetDate))) {
        throw new ForbiddenException(
          `Rate limit reached. Resets at ${dayjs(user.tokenCountResetDate).toString()}`,
        );
      }
    }
    /*
    // ───────────────────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = await this.lmStudioService.openAi.responses.create({
      model: dto.model,
      input: dto.input as string,
      reasoning: {
        summary: 'auto',
        effort: 'medium',
      },
      stream: true,
      tools: [
        {
          type: 'mcp',
          server_label: 'liquid-local-ai-client-toolbox',
          server_url: this.lmStudioService.selfMcpUrl,
          headers: {
            authorization: `Bearer ${token}`,
          },
          allowed_tools: ['greeting-tool', 'get-token-usage-tool'],
        },
      ],
      previous_response_id: dto.previous_response_id,
      store: true,
    });
    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
    */
    return this.lmStudioService.chatStream(
      userId,
      dto,
      res,
      token,
      internalChatId,
      name,
      internalChatId,
    );
  }
}
