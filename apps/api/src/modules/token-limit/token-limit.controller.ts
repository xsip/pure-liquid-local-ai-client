import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { TokenLimitService } from './token-limit.service';
import { TokenLimitConfig } from './token-limit-config.schema';
import {
  CreateTokenLimitConfigDto,
  UpdateTokenLimitConfigDto,
} from './dto/token-limit-config.dto';
import { SubscriptionType } from '../auth/user.schema';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.decorator';

@ApiTags('Token Limit Config')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('token-limit-configs')
export class TokenLimitController {
  constructor(private readonly tokenLimitService: TokenLimitService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a token-limit config for a subscription tier',
    operationId: 'createTokenLimitConfig',
  })
  create(@Body() dto: CreateTokenLimitConfigDto): Promise<TokenLimitConfig> {
    return this.tokenLimitService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all token-limit configs',
    operationId: 'findAllTokenLimitConfigs',
  })
  findAll(): Promise<TokenLimitConfig[]> {
    return this.tokenLimitService.findAll();
  }

  @Get('subscription/:subscription')
  @ApiOperation({
    summary: 'Get the token-limit config for a specific subscription tier',
    operationId: 'findTokenLimitConfigBySubscription',
  })
  @ApiParam({ name: 'subscription', enum: SubscriptionType })
  findBySubscription(
    @Param('subscription') subscription: SubscriptionType,
  ): Promise<TokenLimitConfig> {
    return this.tokenLimitService.findBySubscription(subscription);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a token-limit config by id',
    operationId: 'findTokenLimitConfigById',
  })
  findById(@Param('id') id: string): Promise<TokenLimitConfig> {
    return this.tokenLimitService.findById(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a token-limit config',
    operationId: 'updateTokenLimitConfig',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTokenLimitConfigDto,
  ): Promise<TokenLimitConfig> {
    return this.tokenLimitService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a token-limit config',
    operationId: 'deleteTokenLimitConfig',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.tokenLimitService.remove(id);
  }
}
