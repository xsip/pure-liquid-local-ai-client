import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EphemeralMcpIntegrationDto } from './dto/ephemeral-mcp-integration.dto';
import { ChatMcpOverrideDto } from './dto/chat-mcp-override.dto';
import { IsIn, IsOptional } from 'class-validator';
import { SubscriptionType } from '../auth/user.schema';
import { InvokeAiModel } from '../invoke/invoke.service';
import { Role } from '../auth/roles.decorator';
import { AssetBlob } from '../assets/asset-blob.schema';

export type ChatMetadataDocument = ChatMetadata & Document;

export enum ChatClient {
  OPENAI = 'OPENAI',
  LMSTUDIO = 'LMSTUDIO',
}

export enum GeneratedAssetType {
  IMAGE = 'IMAGE',
  FILE = 'FILE',
}

export enum OpenAiEndpointPreference {
  RESPONSES = 'RESPONSES',
  COMPLETION = 'COMPLETION',
}

@Schema()
export class GeneratedAsset {
  @Prop({ required: true })
  filename: string;

  @Prop({ required: true, type: Types.ObjectId, ref: AssetBlob.name })
  refId: Types.ObjectId | AssetBlob;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true, enum: GeneratedAssetType })
  type: GeneratedAssetType;

  @Prop()
  thumbnail?: string;

  @Prop()
  sizeKb?: number;

  @Prop()
  mimeType?: string;

  @Prop()
  isVisible: boolean;
}
@Schema({ collection: 'chat_metadata', timestamps: true })
export class ChatMetadata {
  /** Human-readable name for this chat session */
  @Prop({ required: true, type: String })
  name: string;

  /**
   * The ObjectId of this document IS the reference key used to look up all
   * messages in the "chats" collection via `chatInternalId`.
   * We store it as a virtual — consumers use `_id.toHexString()`.
   */

  /** Which LLM model was used for this session */
  @Prop({ required: true, type: String })
  usedModel: string;

  /** Which Client model was used for this session */
  @Prop({ required: true, type: String })
  client: ChatClient;

  /** Owner — ObjectId of the authenticated user who created this metadata */
  @Prop({ required: true, type: Types.ObjectId, index: true, ref: 'User' })
  userId: Types.ObjectId;

  /** Reasoning mode identifier (e.g. "off", "low", "medium", "high", "on") */
  @Prop({ required: false, type: String })
  reasoningMode?: string;

  /** MCP tool integrations configured for this session */
  @Prop({ required: false, default: [], type: [Object] })
  tools: EphemeralMcpIntegrationDto[];

  /**
   * Per-chat opt-out overrides for the user's account-level custom MCP
   * servers (User.customMcps). A server with no entry here is enabled with
   * all of its account-level allowed tools — overrides only need to record
   * what was turned off for this specific chat.
   */
  @Prop({ required: false, default: [], type: [Object] })
  mcpOverrides: ChatMcpOverrideDto[];

  @Prop({ required: false, type: Date })
  lastMessageSentAt: Date;

  @Prop({ required: false, type: Boolean })
  useCrypto?: boolean;

  @Prop({ required: false, type: String })
  cryptoKey?: string;

  @Prop({
    required: false,
    enum: Object.values(OpenAiEndpointPreference),
    default: OpenAiEndpointPreference.RESPONSES,
  })
  openAiEndpointPreference?: OpenAiEndpointPreference;

  @Prop({ required: false, type: [GeneratedAsset] })
  generatedAssets?: GeneratedAsset[];

  @Prop({ required: false, type: [GeneratedAsset] })
  userAssets?: GeneratedAsset[];

  @Prop({ required: false, type: Boolean })
  useInvoke?: boolean;

  @Prop({
    required: false,
    enum: Object.values(InvokeAiModel),
    default: InvokeAiModel.DREAMSHAPER_8,
  })
  invokeAiModelToUse?: InvokeAiModel;

  /** Other users granted read/write access to this chat */
  @Prop({ required: false, default: [], type: [Types.ObjectId], ref: 'User' })
  sharedWith: Types.ObjectId[];

  /** True while a prompt is currently streaming — blocks new messages from anyone */
  @Prop({ required: false, default: false, type: Boolean })
  locked: boolean;

  // `createdAt` / `updatedAt` injected automatically
}

export const ChatMetadataSchema = SchemaFactory.createForClass(ChatMetadata);

// ── Swagger-friendly response DTO ────────────────────────────────────────────

export class GeneratedAssetDto {
  @ApiProperty()
  _id?: string;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  refId: string;

  @ApiProperty({
    enum: GeneratedAssetType,
    type: 'string',
  })
  type: GeneratedAssetType;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional()
  thumbnail?: string;

  @ApiPropertyOptional()
  sizeKb?: number;

  @ApiPropertyOptional()
  mimeType?: string;
}

export class ChatMetadataDto {
  @ApiProperty({
    description:
      'MongoDB ObjectId — use as chatInternalId when fetching messages',
  })
  _id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['OPENAI', 'LMSTUDIO'] })
  @IsIn(['OPENAI', 'LMSTUDIO'])
  client: 'OPENAI' | 'LMSTUDIO';

  @ApiProperty()
  usedModel: string;

  @ApiProperty({ description: 'ObjectId of the owning user' })
  userId: string;

  @ApiProperty()
  reasoningMode?: string;

  @ApiPropertyOptional({ type: [EphemeralMcpIntegrationDto] })
  tools: EphemeralMcpIntegrationDto[];

  @ApiPropertyOptional({ type: [ChatMcpOverrideDto] })
  mcpOverrides?: ChatMcpOverrideDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  useCrypto?: boolean;

  @ApiPropertyOptional()
  cryptoKey?: string;

  @ApiPropertyOptional({
    enum: OpenAiEndpointPreference,
  })
  openAiEndpointPreference?: OpenAiEndpointPreference;

  @ApiPropertyOptional({
    type: GeneratedAssetDto,
    isArray: true,
  })
  generatedAssets?: GeneratedAssetDto[];

  @ApiPropertyOptional({
    type: GeneratedAssetDto,
    isArray: true,
  })
  userAssets?: GeneratedAssetDto[];

  @ApiProperty()
  lastMessageSentAt?: Date;

  @ApiPropertyOptional()
  useInvoke?: boolean;

  @ApiPropertyOptional({
    enum: InvokeAiModel,
  })
  invokeAiModelToUse?: InvokeAiModel;

  @ApiPropertyOptional({
    type: [String],
    description: 'ObjectIds of users granted access to this chat',
  })
  sharedWith?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Usernames of users in sharedWith, same order/index — resolved server-side',
  })
  sharedWithUsernames?: string[];

  @ApiPropertyOptional({
    description: 'True while a prompt is currently streaming for this chat',
  })
  locked?: boolean;
}
