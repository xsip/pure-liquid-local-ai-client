import {
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EphemeralMcpIntegrationDto } from './ephemeral-mcp-integration.dto';
import { ChatMcpOverrideDto } from './chat-mcp-override.dto';
import { OpenAiEndpointPreference } from '../chat-metadata.schema';
import { InvokeAiModel } from '../../invoke/invoke.service';

export class CreateAndAddToUserAssetsResponseDto {
  @ApiProperty({ description: 'Asset size in KB' })
  sizeKb: number;
  @ApiProperty({ description: 'URL to asset' })
  assetUrl: string;
  @ApiProperty({ description: 'Filename' })
  filename: string;
  @ApiProperty({ description: 'Internal Filename' })
  internalFilename: string;
}

export class CreateChatMetadataDto {
  @ApiProperty({ description: 'Human-readable name for this chat session' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'LLM model identifier used in this session' })
  @IsString()
  usedModel: string;

  @ApiProperty({ enum: ['OPENAI', 'LMSTUDIO'] })
  @IsIn(['OPENAI', 'LMSTUDIO'])
  client: 'OPENAI' | 'LMSTUDIO';

  @ApiProperty({
    description: 'Reasoning mode (e.g. off / low / medium / high / on)',
  })
  @IsString()
  reasoningMode: string;

  @ApiPropertyOptional({
    description: 'MCP integrations to associate with this session',
    type: [EphemeralMcpIntegrationDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EphemeralMcpIntegrationDto)
  tools?: EphemeralMcpIntegrationDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  useCrypto?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cryptoKey?: string;

  @ApiPropertyOptional({
    enum: OpenAiEndpointPreference,
  })
  @IsOptional()
  openAiEndpointPreference?: OpenAiEndpointPreference;

  @ApiPropertyOptional()
  @IsOptional()
  useInvoke?: boolean;

  @ApiPropertyOptional({
    enum: InvokeAiModel,
  })
  @IsOptional()
  invokeAiModelToUse?: InvokeAiModel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  transcribeAudio?: boolean;

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @IsDate()
  lastMessageSentAt?: Date;

  @ApiPropertyOptional({
    description: 'Opt-out overrides for the user\'s account-level custom MCP servers',
    type: [ChatMcpOverrideDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMcpOverrideDto)
  mcpOverrides?: ChatMcpOverrideDto[];
}
