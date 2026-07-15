import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BranchChatDto {
  @ApiProperty({
    description:
      'Ordinal (1-based) of the assistant reply to branch after — the new chat keeps history through this Nth assistant message',
  })
  @IsInt()
  @Min(0)
  keepMessageCount: number;
}
