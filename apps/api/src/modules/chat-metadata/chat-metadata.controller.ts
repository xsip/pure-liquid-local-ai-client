import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { ChatMetadataService } from './chat-metadata.service';
import { ChatMetadataDto } from './chat-metadata.schema';
import {
  CreateAndAddToUserAssetsResponseDto,
  CreateChatMetadataDto,
} from './dto/create-chat-metadata.dto';
import { UpdateChatMetadataDto } from './dto/update-chat-metadata.dto';
import { BranchChatDto } from './dto/branch-chat.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/user.schema';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AssetRole } from '../assets/asset-blob.schema';
import { ShareChatDto } from './dto/share-chat.dto';

@ApiTags('Chat Metadata')
@ApiBearerAuth()
@Controller('chats-metadata')
export class ChatMetadataController {
  constructor(private readonly chatMetadataService: ChatMetadataService) {}

  // ── POST /chats/metadata ─────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Create a new chat metadata entry',
    operationId: 'createChatMetadata',
  })
  @ApiCreatedResponse({ type: ChatMetadataDto })
  create(@CurrentUser() user: User, @Body() dto: CreateChatMetadataDto) {
    const userId = (user as any)._id as Types.ObjectId;
    return this.chatMetadataService.create(userId, dto);
  }

  // ── GET /chats/metadata ──────────────────────────────────────────────────

  @Get('')
  @ApiOperation({
    summary:
      'List all chat metadata entries belonging to the authenticated user',
    operationId: 'listChatMetadata',
  })
  @ApiOkResponse({ type: [ChatMetadataDto] })
  async findAll(@CurrentUser() user: User) {
    try {
      const userId = (user as any)._id as Types.ObjectId;
      const res = await this.chatMetadataService.findAll(userId);
      return res;
    } catch (error) {
      console.log(error);
    }
    return [];
  }

  // ── GET /chats/metadata/:id ──────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary:
      'Get a single chat metadata entry (must belong to the authenticated user)',
    operationId: 'getChatMetadata',
  })
  @ApiParam({ name: 'id', description: 'ChatMetadata ObjectId' })
  @ApiOkResponse({ type: ChatMetadataDto })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Belongs to a different user' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const userId = (user as any)._id as Types.ObjectId;
    return this.chatMetadataService.findOne(userId, id);
  }

  // ── PATCH /chats/metadata/:id ────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a chat metadata entry',
    operationId: 'updateChatMetadata',
  })
  @ApiParam({ name: 'id', description: 'ChatMetadata ObjectId' })
  @ApiOkResponse({ type: ChatMetadataDto })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Belongs to a different user' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateChatMetadataDto,
  ) {
    const userId = (user as any)._id as Types.ObjectId;
    return this.chatMetadataService.update(userId, id, dto);
  }

  // ── DELETE /chats/metadata/:id ───────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a chat metadata entry and all associated messages in the chats collection',
    operationId: 'deleteChatMetadata',
  })
  @ApiParam({ name: 'id', description: 'ChatMetadata ObjectId' })
  @ApiNoContentResponse({
    description: 'Deleted (cascade includes chat messages)',
  })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Belongs to a different user' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    const userId = (user as any)._id as Types.ObjectId;
    return this.chatMetadataService.remove(userId, id);
  }

  // ── POST /chats-metadata/:id/share ───────────────────────────────────────

  @Post(':id/share')
  @ApiOperation({
    summary: 'Grant another user (by username) read/write access to this chat',
    operationId: 'shareChatMetadata',
  })
  @ApiParam({ name: 'id', description: 'ChatMetadata ObjectId' })
  @ApiBody({ type: ShareChatDto })
  @ApiOkResponse({ type: ChatMetadataDto })
  @ApiNotFoundResponse({ description: 'Not found, or target user not found' })
  @ApiForbiddenResponse({ description: 'Only the owner can share a chat' })
  shareChat(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: ShareChatDto,
  ) {
    const userId = (user as any)._id as Types.ObjectId;
    return this.chatMetadataService.shareChat(userId, id, body.username);
  }

  // ── POST /chats-metadata/:id/branch ──────────────────────────────────────

  @Post(':id/branch')
  @ApiOperation({
    summary:
      'Clone this chat\'s settings into a new chat, silently, seeded with the first N messages of its history ("Branch in new chat")',
    operationId: 'branchChatMetadata',
  })
  @ApiParam({ name: 'id', description: 'ChatMetadata ObjectId of the chat being branched' })
  @ApiBody({ type: BranchChatDto })
  @ApiCreatedResponse({ type: ChatMetadataDto })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'No access to this chat' })
  branchChat(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: BranchChatDto,
  ) {
    const userId = (user as any)._id as Types.ObjectId;
    return this.chatMetadataService.branch(userId, id, body);
  }

  // ── DELETE /chats-metadata/:id/share/:userId ─────────────────────────────

  @Delete(':id/share/:userId')
  @ApiOperation({
    summary: "Revoke a shared user's access to this chat",
    operationId: 'unshareChatMetadata',
  })
  @ApiParam({ name: 'id', description: 'ChatMetadata ObjectId' })
  @ApiParam({ name: 'userId', description: 'ObjectId of the user to revoke' })
  @ApiOkResponse({ type: ChatMetadataDto })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Only the owner can revoke access' })
  unshareChat(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    const userId = (user as any)._id as Types.ObjectId;
    return this.chatMetadataService.unshareChat(userId, id, targetUserId);
  }

  @Post('upload-file/:chatId')
  @ApiOperation({
    operationId: 'uploadFile',
    summary: 'Upload an file  for a specific chat',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({
    description: '{ url: string }',
    type: CreateAndAddToUserAssetsResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // fileFilter: IMAGE_FILTER,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiParam({
    name: 'chatId',
    description: 'ChatId the file belongs to',
  })
  async uploadFile(
    @CurrentUser() user: User & { _id?: Types.ObjectId },
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() _user: User,
    @Param('chatId')
    chatId: string,
  ): Promise<CreateAndAddToUserAssetsResponseDto> {
    if (!file) throw new BadRequestException('No file provided');
    return this.chatMetadataService.uploadAndAddAssetToChat(
      user._id + '',
      chatId,
      AssetRole.USER,
      file.originalname,
      file.buffer,
      file.mimetype,
    );
  }
}
