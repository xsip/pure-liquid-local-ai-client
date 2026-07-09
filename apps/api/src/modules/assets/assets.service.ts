import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AssetRole, AssetBlob, AssetBlobDocument } from './asset-blob.schema';
import { DeleteResult, Model, Types } from 'mongoose';
import { ChatMetadataService } from '../chat-metadata/chat-metadata.service';

@Injectable()
export class AssetsService {
  constructor(
    @InjectModel(AssetBlob.name)
    private readonly assetBlobModel: Model<AssetBlobDocument>,
    private readonly chatMetadataService: ChatMetadataService,
  ) {}

  async setAssetVisibility(
    userId: string,
    chatId: string,
    filename: string,
    isVisible: boolean,
  ): Promise<void> {
    const blob = await this.assetBlobModel
      .findOne({ userId, chatId, filename })
      .exec();
    if (!blob) return;
    blob.isVisible = isVisible;

    await blob.save();
  }

  async deleteAsset(
    userId: string,
    chatId: string,
    filename: string,
  ): Promise<DeleteResult> {
    return this.assetBlobModel.deleteOne({ userId, chatId, filename }).exec();
  }
  async getAsset(
    userId: string,
    chatId: string,
    filename: string,
    thumbnail?: boolean,
  ): Promise<AssetBlobDocument> {
    // Prevent path traversal
    if (filename.includes('..')) {
      throw new NotFoundException();
    }

    // Access is granted to the owner as well as anyone the chat has been
    // shared with, so resolve the blob by chat + filename only and defer
    // the authorization check to ChatMetadataService (owner-or-shared).
    await this.chatMetadataService.findOne(new Types.ObjectId(userId), chatId);

    const projection = thumbnail
      ? { data: 0 } // exclude full image
      : {};

    const blob = await this.assetBlobModel
      .findOne({ chatId, filename }, projection)
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
    isVisible: boolean,
    thumbnailData?: Buffer,
  ) {
    const ext = originalFilename.split('.').pop()?.toLowerCase() ?? 'bin';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const res = await this.assetBlobModel.create({
      userId,
      chatId,
      filename,
      mimeType,
      isVisible,
      role,
      displayName: originalFilename,
      data,
      thumbnailData,
    });

    return { url: `assets/${chatId}/${filename}`, filename, id: res._id };
  }
}
