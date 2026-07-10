import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { AdminUserDto } from './dto/admin-user.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/user.schema';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users', operationId: 'adminListUsers' })
  findAll(): Promise<AdminUserDto[]> {
    return this.adminUsersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id', operationId: 'adminGetUser' })
  findById(@Param('id') id: string): Promise<AdminUserDto> {
    return this.adminUsersService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user', operationId: 'adminCreateUser' })
  create(@Body() dto: CreateAdminUserDto): Promise<AdminUserDto> {
    return this.adminUsersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user', operationId: 'adminUpdateUser' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ): Promise<AdminUserDto> {
    return this.adminUsersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user', operationId: 'adminDeleteUser' })
  remove(
    @CurrentUser() currentUser: User & { _id?: Types.ObjectId },
    @Param('id') id: string,
  ): Promise<void> {
    if ((currentUser._id as any)?.toString() === id) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    return this.adminUsersService.remove(id);
  }

  @Post(':id/reset-tokens')
  @ApiOperation({
    summary: "Reset a user's token usage counter",
    operationId: 'adminResetUserTokens',
  })
  resetTokens(@Param('id') id: string): Promise<AdminUserDto> {
    return this.adminUsersService.resetTokens(id);
  }
}
