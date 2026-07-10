import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../auth/roles.decorator';
import { SubscriptionType } from '../../auth/user.schema';

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ description: 'New password — leave unset to keep the current one' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: SubscriptionType })
  @IsOptional()
  @IsEnum(SubscriptionType)
  subscription?: SubscriptionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActivated?: boolean;
}
