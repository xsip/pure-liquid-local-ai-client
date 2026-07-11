import { IsArray, IsBoolean, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Per-chat override of a user's custom MCP server (User.customMcps[].id).
 * Absence of an override for a given mcpId means "enabled, all tools allowed"
 * (the account-level default) — overrides only need to be written when the
 * user opts a server/tool out for this specific chat.
 */
export class ChatMcpOverrideDto {
  @ApiProperty({ description: 'References User.customMcps[].id' })
  @IsString()
  mcpId: string;

  @ApiProperty()
  @IsBoolean()
  active: boolean;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  allowedTools: string[];
}
