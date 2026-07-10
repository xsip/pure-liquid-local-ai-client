import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../auth/roles.decorator';
import { SubscriptionType } from '../../auth/user.schema';

export class AdminUserDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ enum: SubscriptionType })
  subscription: SubscriptionType;

  @ApiProperty()
  isActivated: boolean;

  @ApiProperty()
  usedTokens: number;

  @ApiPropertyOptional({ type: Date, nullable: true })
  tokenCountResetDate: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
