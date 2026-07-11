import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** A user-registered MCP server, plus which of its tools the user allows. */
export class CustomMcpDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  endpoint: string;

  @ApiProperty()
  @IsBoolean()
  active: boolean;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  availableTools: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  allowedTools: string[];

  @ApiPropertyOptional({
    description: 'Custom HTTP headers sent to this MCP server',
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class AddCustomMcpDto {
  @ApiProperty()
  @IsString()
  endpoint: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class UpdateCustomMcpDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTools?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}
