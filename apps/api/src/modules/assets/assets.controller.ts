import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Types } from 'mongoose';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/user.schema';
import { AssetsService } from './assets.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Public } from '../auth/public.decorator';
import { AssetRole } from './image-blob.schema';

const IMAGE_FILTER = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowed = /^image\/(jpeg|jpg|png|webp|gif|avif)$/;
  if (allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Only image files are allowed'), false);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Public assets controller  — GET /assets/:tenant/:image
// Retrieves image blobs from MongoDB by tenant + filename
// ─────────────────────────────────────────────────────────────────────────────
@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetService: AssetsService) {}

  @Get('filequery/:filename')
  @ApiOperation({
    operationId: 'getImageQuery',
    summary: 'Retrieve an file blob from the database for a chat',
  })
  @ApiParam({
    name: 'filename',
    description: 'Filename returned by the upload endpoint',
  })
  @ApiQuery({
    name: 'chatId',
    description: 'ChatId the file belongs to',
  })
  @ApiQuery({
    name: 'userId',
    description: 'User the file belongs to',
  })
  @ApiOkResponse({ description: 'Binary image data with correct Content-Type' })
  @ApiNotFoundResponse({ description: 'File not found' })
  async getImageQuery(
    @Param('filename')
    filename: string,
    @Query('chatId')
    chatId: string,
    @Query('userId')
    userId: string,
    @Res() res: Response,
  ) {
    const blob = await this.assetService.getAsset(userId, chatId, filename);

    // Validate stored MIME type
    const allowed = /^image\/(jpeg|jpg|png|webp|gif|avif)$/;
    if (!allowed.test(blob.mimeType)) {
      throw new NotFoundException('Invalid image type');
    }

    res.setHeader('Content-Type', blob.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    res.send(blob.data);
  }

  @Get(':chatId/:filename')
  @ApiOperation({
    operationId: 'getImage',
    summary: 'Retrieve an file blob from the database for a chat',
  })
  @ApiParam({
    name: 'filename',
    description: 'Filename returned by the upload endpoint',
  })
  @ApiParam({
    name: 'chatId',
    description: 'ChatId the file belongs to',
  })
  @ApiQuery({
    name: 'thumbnail',
    type: 'boolean',
    required: false,
    description: `Only return thumbnail if true`,
  })
  @ApiOkResponse({ description: 'Binary image data with correct Content-Type' })
  @ApiNotFoundResponse({ description: 'File not found' })
  async image(
    @CurrentUser() user: User & { _id?: Types.ObjectId },
    @Param('filename')
    filename: string,
    @Param('chatId')
    chatId: string,
    @Query('thumbnail')
    thumbnail: boolean,
    @Res() res: Response,
  ) {
    const blob = await this.assetService.getAsset(
      user._id + '',
      chatId,
      filename,
      thumbnail,
    );

    /* Validate stored MIME type
    const allowed = /^image\/(jpeg|jpg|png|webp|gif|avif)$/;
    if (!allowed.test(blob.mimeType)) {
      throw new NotFoundException('Invalid image type');
    }*/

    res.setHeader('Content-Type', blob.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    res.send(thumbnail ? blob.thumbnailData : blob.data);
  }

  @Post(':chatId')
  @ApiOperation({
    operationId: 'uploadImage',
    summary: 'Upload an image for a specific chat',
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
  @ApiCreatedResponse({ description: '{ url: string }' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: IMAGE_FILTER,
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
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file provided');
    return this.assetService.uploadFile(
      user._id + '',
      chatId,
      AssetRole.USER,
      file.originalname,
      file.buffer,
      file.mimetype,
      true,
    );
  }
}
