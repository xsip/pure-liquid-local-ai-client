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
  getSchemaPath,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { Response } from 'express';
import dayjs from 'dayjs';

import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/user.schema';
import { CurrentToken } from '../auth/current-token.decorator';
import { TokenLimitService } from '../token-limit/token-limit.service';
import { OpenAiService } from './openai.service';

import { ModelOpenAiDto } from './dto/model-dtos';
import { ChatCompletionCreateParamsStreamingDto } from './dto/completions-dtos/ChatCompletionCreateParamsStreamingDto';
import { ChatCompletionCreateParamsNonStreamingDto } from './dto/completions-dtos/ChatCompletionCreateParamsNonStreamingDto';
import { OpenAiEndpointPreference } from '../chat-metadata/chat-metadata.schema';
import { ChatCompletionDto } from './dto/completions-dtos/ChatCompletionDto';
import { InvokeAiModel } from '../invoke/invoke.service';

@ApiTags('OpenAI')
@ApiBearerAuth()
@Controller('openai')
export class OpenaiController {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly tokenLimitService: TokenLimitService,
  ) {}

  @Get('models')
  @ApiOperation({
    summary: 'List all available models (LLMs and embedding models)',
    operationId: 'getModelsOpenAi',
  })
  @ApiOkResponse({ type: ModelOpenAiDto, isArray: true })
  getModels(): Promise<ModelOpenAiDto[]> {
    return this.openAiService.getModels();
  }

  @ApiExtraModels(
    ChatCompletionCreateParamsNonStreamingDto,
    ChatCompletionCreateParamsStreamingDto,
  )
  @Post('completions-stream')
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
    operationId: 'completionsStreamOpenAi',
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
    name: 'useCrypto',
    required: false,
    type: 'boolean',
    description: 'Use crypto for new chat',
  })
  @ApiQuery({
    name: 'chatName',
    type: 'string',
    required: false,
    description: 'Name for new chat',
  })
  @ApiQuery({
    name: 'cryptoKey',
    type: 'string',
    required: false,
    description: 'Key for new chat encryption',
  })
  @ApiQuery({
    name: 'openAiEndpointPreference',
    type: 'string',
    enum: OpenAiEndpointPreference,
    default: OpenAiEndpointPreference.RESPONSES,
    required: false,
    description: 'openAiEndpointPreference for new chat',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          $ref: getSchemaPath(ChatCompletionCreateParamsNonStreamingDto),
        },
        {
          $ref: getSchemaPath(ChatCompletionCreateParamsStreamingDto),
        },
      ],
    },
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'Server-Sent Events stream. When no `internalChatId` was supplied, ' +
      'a synthetic `event: created_chat / data: {"type":"created_chat","result":"<md5>"}` ' +
      'event is emitted just before the stream closes.',
    schema: { type: 'string', format: 'binary' },
  })
  /*http://192.168.0.39:4200/api/openai/chat-stream?chatName=Test&useCrypto=true&cryptoKey=123456&openAiEndpointPreference=RESPONSES*/
  async completionsStream(
    @CurrentUser() user: User,
    @CurrentToken() token: string,
    @Body()
    dto:
      | ChatCompletionCreateParamsNonStreamingDto
      | ChatCompletionCreateParamsStreamingDto,
    @Res() res: Response,
    @Query()
    query?: {
      chatName: string;
      useCrypto: boolean;
      cryptoKey: string;
      internalChatId: string;
      openAiEndpointPreference: OpenAiEndpointPreference;
      letAiDecideChatName?: boolean;
      useInvoke?: boolean;
      invokeModel?: InvokeAiModel;
      mcpOverrides?: string;
    },
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

    return this.openAiService.chatStreamCompletions(
      userId,
      dto,
      res,
      token,
      query?.internalChatId,
      {
        ...query,
        letAiDecideChatName:
          (query?.letAiDecideChatName as unknown) === 'true' ||
          query?.letAiDecideChatName === true,
        useInvoke:
          (query?.useInvoke as unknown) === 'true' || query?.useInvoke === true,
        mcpOverrides: this.parseMcpOverrides(query?.mcpOverrides),
      } as any,
    );
    // ───────────────────────────────────────────────────────────────────────
  }

  private parseMcpOverrides(raw?: string): any[] | undefined {
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  @ApiExtraModels(
    ChatCompletionCreateParamsNonStreamingDto,
    ChatCompletionCreateParamsStreamingDto,
  )
  @Post('completions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stream a chat response via SSE',
    description:
      'Returns the LM Studio response as Server-Sent Events. ' +
      'Each exchange is persisted in MongoDB under the given `internalChatId`. ' +
      'If `internalChatId` is supplied, the latest `response_id` for that session ' +
      'is fetched from the DB and set as `previous_response_id` on the request ' +
      'so LM Studio maintains conversation context. ' +
      'If `internalChatId` is omitted a new session is created and its generated ' +
      'ID is returned via a `created_chat` SSE event before the stream closes.',
    operationId: 'completionsOpenAi',
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
    name: 'useCrypto',
    required: false,
    type: 'boolean',
    description: 'Use crypto for new chat',
  })
  @ApiQuery({
    name: 'chatName',
    type: 'string',
    required: false,
    description: 'Name for new chat',
  })
  @ApiQuery({
    name: 'cryptoKey',
    type: 'string',
    required: false,
    description: 'Key for new chat encryption',
  })
  @ApiQuery({
    name: 'openAiEndpointPreference',
    type: 'string',
    enum: OpenAiEndpointPreference,
    default: OpenAiEndpointPreference.RESPONSES,
    required: false,
    description: 'openAiEndpointPreference for new chat',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          $ref: getSchemaPath(ChatCompletionCreateParamsNonStreamingDto),
        },
        {
          $ref: getSchemaPath(ChatCompletionCreateParamsStreamingDto),
        },
      ],
    },
  })
  @ApiOkResponse({ type: ChatCompletionDto })
  async completions(
    @CurrentUser() user: User,
    @CurrentToken() token: string,
    @Body()
    dto:
      | ChatCompletionCreateParamsNonStreamingDto
      | ChatCompletionCreateParamsStreamingDto,
    @Res({ passthrough: true }) res: Response,
    @Query()
    query?: {
      chatName?: string;
      useCrypto?: boolean;
      cryptoKey?: string;
      internalChatId?: string;
      openAiEndpointPreference?: OpenAiEndpointPreference;
    },
  ): Promise<ChatCompletionDto> {
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

    return this.openAiService.chatCompletions(
      userId,
      dto,
      res,
      token,
      query?.internalChatId,
      '',
      query?.internalChatId,
    );
    // ───────────────────────────────────────────────────────────────────────
  }
}
