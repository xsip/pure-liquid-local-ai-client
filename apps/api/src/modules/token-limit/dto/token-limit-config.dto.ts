import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsPositive } from 'class-validator';
import { SubscriptionType } from '../../auth/user.schema';

export class CreateTokenLimitConfigDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  minutesTillReset: number;

  @ApiProperty({ example: 9000 })
  @IsInt()
  @IsPositive()
  tokensPerInterval: number;

  @ApiProperty({ enum: SubscriptionType, example: SubscriptionType.BASIC })
  @IsEnum(SubscriptionType)
  subscription: SubscriptionType;
}

export class UpdateTokenLimitConfigDto extends PartialType(
  CreateTokenLimitConfigDto,
) {}
