import {
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EphemeralMcpIntegrationDto } from './ephemeral-mcp-integration.dto';
import { ChatMcpOverrideDto } from './chat-mcp-override.dto';
import { OpenAiEndpointPreference } from '../chat-metadata.schema';
import { InvokeAiModel } from '../../invoke/invoke.service';

export class UpdateChatMetadataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  usedModel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasoningMode?: string;

  @ApiPropertyOptional({ type: [EphemeralMcpIntegrationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EphemeralMcpIntegrationDto)
  tools?: EphemeralMcpIntegrationDto[];

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @IsDate()
  lastMessageSentAt: Date;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  toolsRequireApproval?: boolean;

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
