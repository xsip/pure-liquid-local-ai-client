import { ApiProperty } from '@nestjs/swagger';
import { CustomMcpDto } from './dto/custom-mcp.dto';

export class MeDto {
  @ApiProperty()
  username: string;
  @ApiProperty()
  role: string;
  @ApiProperty()
  subscription: string;
  @ApiProperty()
  isActivated: boolean;
  @ApiProperty()
  usedTokens: number;
  @ApiProperty({ type: Date })
  tokenCountResetDate: Date | null;
  @ApiProperty()
  tokenLimit: number;
  @ApiProperty({ type: [CustomMcpDto] })
  customMcps: CustomMcpDto[];
}
