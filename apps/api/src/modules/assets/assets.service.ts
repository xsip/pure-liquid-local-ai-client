import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AssetRole, ImageBlob, ImageBlobDocument } from './image-blob.schema';
import { DeleteResult, Model } from 'mongoose';

@Injectable()
export class AssetsService {
  constructor(
    @InjectModel(ImageBlob.name)
    private readonly imageBlobModel: Model<ImageBlobDocument>,
  ) {}


  async deleteAsset(
    userId: string,
    chatId: string,
    filename: string
  ): Promise<DeleteResult> {
    return this.imageBlobModel
      .deleteOne({ userId, chatId, filename })
      .exec();
  }
  async getAsset(
    userId: string,
    chatId: string,
    filename: string,
    thumbnail?: boolean,
  ): Promise<ImageBlobDocument> {
    // Prevent path traversal
    if (filename.includes('..')) {
      throw new NotFoundException();
    }

    const projection = thumbnail
      ? { data: 0 } // exclude full image
      : {};

    const blob = await this.imageBlobModel
      .findOne({ userId, chatId, filename }, projection)
      .exec();

    if (!blob) {
      throw new NotFoundException('Image not found');
    }

    return blob;
  }
  async uploadFile(
    userId: string,
    chatId: string,
    role: AssetRole,
    originalFilename: string,
    data: Buffer,
    mimeType: string,
    thumbnailData?: Buffer,
  ) {
    const ext = originalFilename.split('.').pop()?.toLowerCase() ?? 'bin';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const res = await this.imageBlobModel.create({
      userId,
      chatId,
      filename,
      mimeType,
      role,
      displayName: originalFilename,
      data,
      thumbnailData,
    });

    return { url: `assets/${chatId}/${filename}`, filename, id: res._id };
  }
}
