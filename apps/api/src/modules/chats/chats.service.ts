import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument, ChatEntryDto } from './chat.schema';
import { ChatRequestDto } from '../lm-studio/dto/chat.dto';
import { ChatResponseDto } from '../lm-studio/dto/chat-response.dto';
import { ResponseCreateParamsNonStreamingDto } from '../openai/dto/create-response-dtos';
import { ResponseCreateParamsStreamingDto } from '../openai/dto/create-response-dtos/ResponseCreateParamsStreamingDto';
import { ResponseDto } from '../openai/dto/get-response-dtos';
import * as CryptoJS from 'crypto-js';
import { ChatMetadataService } from '../chat-metadata/chat-metadata.service';
import {
  ChatClient,
  ChatMetadata,
} from '../chat-metadata/chat-metadata.schema';
import { User, UserDocument } from '../auth/user.schema';
@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly chatMetadataService: ChatMetadataService,
  ) {}

  /**
   * Persist a single chat exchange under the given chat ID.
   * previousResponseId / responseId are extracted from the DTOs automatically.
   */
  async saveEntry(
    userId: Types.ObjectId,
    internalChatId: string,
    request:
      | ChatRequestDto
      | ResponseCreateParamsNonStreamingDto
      | ResponseCreateParamsStreamingDto,

    response: ChatResponseDto | ResponseDto,
    name?: string,
    chatInternalId?: string,
  ): Promise<ChatDocument> {
    const doc = new this.chatModel({
      userId,
      internalChatId: chatInternalId,
      name: name ?? null,
      request,
      response,
      previousResponseId: request.previous_response_id ?? null,
      responseId:
        (response as ChatResponseDto).response_id ??
        (response as ResponseDto).id ??
        null,
      chatInternalId: chatInternalId ?? null,
    });
    const saved = await doc.save();
    this.logger.log(
      `Saved chat entry — user=${userId} chatId=${internalChatId}`,
    );
    return saved;
  }

  /**
   * Persist a Chat Completions exchange as a rolling message array.
   * Unlike saveEntry (Responses API), there is no previous_response_id
   * chaining — the latest doc for internalChatId holds full history.
   */
  async saveCompletionEntry(
    userId: Types.ObjectId,
    internalChatId: string,
    messages: Record<string, unknown>[],
    name?: string,
    chatInternalId?: string,
  ): Promise<ChatDocument> {
    const doc = new this.chatModel({
      userId,
      internalChatId: chatInternalId,
      name: name ?? null,
      // Non-empty placeholders — Mongoose strips `{}` embedded objects on
      // save (minimize: true), which would otherwise leave `request`/
      // `response` undefined on reload and crash Responses-API-only readers.
      request: { type: 'chat_completions' },
      response: { type: 'chat_completions' },
      messages,
      chatInternalId: chatInternalId ?? null,
    });
    const saved = await doc.save();
    this.logger.log(
      `Saved completion chat entry — user=${userId} chatId=${internalChatId}`,
    );
    return saved;
  }

  /**
   * Fetch the most recent message-array history for a Chat Completions
   * session. Returns an empty array when the session has no entries yet.
   */
  async getMessageHistory(
    userId: Types.ObjectId,
    internalChatId: string,
  ): Promise<Record<string, unknown>[]> {
    const latest = await this.chatModel
      .findOne({ internalChatId, messages: { $ne: null } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!latest) return [];

    // Throws ForbiddenException unless the caller is the owner or a shared user.
    await this.chatMetadataService.findOne(userId, internalChatId);

    return (latest.messages as Record<string, unknown>[]) ?? [];
  }

  /**
   * Fetch the most-recent response_id for a given session belonging to a user.
   * Returns null when the session has no entries yet (first message).
   * Throws ForbiddenException if entries exist but none belong to this user.
   */
  async getLatestResponseId(
    userId: Types.ObjectId,
    internalChatId: string,
  ): Promise<string | null> {
    // Check whether *any* entry exists for this chatId first
    const latest = await this.chatModel
      .findOne({ internalChatId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!latest) return null; // brand-new session, no previous response

    // Entry exists — enforce access (owner or shared user)
    await this.chatMetadataService.findOne(userId, internalChatId);

    return (
      (latest.response as ChatResponseDto).response_id ??
      (latest.response as ResponseDto).id ??
      null
    );
  }

  /**
   * Return all entries for a session, oldest-first.
   * Throws ForbiddenException if the session belongs to a different user.
   */
  async findByInternalChatId(
    userId: Types.ObjectId,
    internalChatId: string,
  ): Promise<ChatEntryDto[]> {
    const entries = await this.chatModel
      .find({ internalChatId })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    if (entries.length === 0) return [];

    // Throws ForbiddenException/NotFoundException unless the caller is the
    // owner or a shared user — the query above already returns entries
    // written by *any* user who has access to this session.
    const chatMeta = await this.chatMetadataService.findOne(
      userId,
      internalChatId,
    );

    const distinctUserIds = [
      ...new Set(entries.map((e) => e.userId.toString())),
    ];
    const users = await this.userModel
      .find({ _id: { $in: distinctUserIds } })
      .select('username')
      .lean()
      .exec();
    const usernameById = new Map(
      users.map((u) => [u._id.toString(), u.username]),
    );

    return entries.map((e) => {
      const username = usernameById.get(e.userId.toString());

      // Chat Completions entries carry their own `messages[]` array and have
      // no Responses-API-shaped `request.input` to decrypt — pass through.
      if (e.messages) {
        return { ...e, username } as unknown as ChatEntryDto;
      }

      return {
        ...e,
        username,
        request: {
          ...e.request,
          input:
            chatMeta.client === ChatClient.OPENAI
              ? this.decryptOpenAiRequest(
                  e.request as ResponseCreateParamsStreamingDto,
                  chatMeta,
                )
              : this.decryptLmStudioRequest(
                  e.request as ChatRequestDto,
                  chatMeta,
                ),
        },
      };
    }) as unknown as ChatEntryDto[];
  }

  decryptOpenAiRequest(
    r: ResponseCreateParamsStreamingDto,
    chatMetadata: ChatMetadata,
  ) {
    if (!chatMetadata.useCrypto || !chatMetadata.cryptoKey) return r.input;

    if (typeof r.input === 'string')
      return this.decrypt(r.input, chatMetadata.cryptoKey!) ?? r.input;
    else if (typeof r.input === 'object' && Array.isArray(r.input)) {
      return r.input.map((i) => {
        if ('content' in i) {
          if (typeof i.content === 'string')
            return {
              ...i,
              content: this.decrypt(i.content, chatMetadata.cryptoKey!),
            };
          else if (typeof i.content === 'object' && Array.isArray(i.content)) {
            return {
              ...i,

              content: i.content.map((ii) => {
                if ('text' in ii) {
                  return {
                    ...ii,
                    text: this.decrypt(ii.text, chatMetadata.cryptoKey!),
                  };
                }
              }),
            };
          }
        }
        return i;
      });
    }
  }

  decryptLmStudioRequest(r: ChatRequestDto, chatMetadata: ChatMetadata) {
    if (!chatMetadata.useCrypto || !chatMetadata.cryptoKey) return r;

    if (typeof r.input === 'string') {
      return this.decrypt(r.input, chatMetadata.cryptoKey!) ?? r.input;
    } else if (typeof r.input === 'object' && Array.isArray(r.input)) {
      return r.input.map((e) => {
        if (e.type === 'message')
          return {
            ...e,
            content: this.decrypt(e.content, chatMetadata.cryptoKey!),
          };
        else if (e.type == 'image')
          return {
            ...e,
            data_url: e.data_url,
          };
      });
    }
  }

  /** Return all unique chat sessions belonging to this user, newest-first. */
  async listChats(
    userId: Types.ObjectId,
  ): Promise<
    { internalChatId: string; name: string | null; lastActivity: Date }[]
  > {
    return this.chatModel
      .aggregate([
        { $match: { userId } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$internalChatId',
            name: { $first: '$name' },
            lastActivity: { $first: '$createdAt' },
          },
        },
        {
          $project: {
            _id: 0,
            internalChatId: '$_id',
            name: 1,
            lastActivity: 1,
          },
        },
        { $sort: { lastActivity: -1 } },
      ])
      .exec();
  }

  decrypt(input: string, key: string) {
    try {
      const res = CryptoJS.AES.decrypt(input, key)?.toString(CryptoJS.enc.Utf8);
      if (!res || res === ' ') return input;
      return res;
    } catch (e: any) {
      console.log(e);
      return input;
    }
  }
}
