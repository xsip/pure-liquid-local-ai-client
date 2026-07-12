import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ResolveToolApprovalDto {
  @ApiProperty({ enum: ['approve', 'deny', 'always'] })
  @IsIn(['approve', 'deny', 'always'])
  decision: 'approve' | 'deny' | 'always';
}
