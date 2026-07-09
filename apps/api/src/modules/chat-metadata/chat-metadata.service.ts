import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ChatMetadata,
  ChatMetadataDocument,
  GeneratedAsset,
  GeneratedAssetDto,
  GeneratedAssetType,
} from './chat-metadata.schema';
import { Chat, ChatDocument } from '../chats/chat.schema';
import { CreateChatMetadataDto } from './dto/create-chat-metadata.dto';
import { UpdateChatMetadataDto } from './dto/update-chat-metadata.dto';
import {
  AssetRole,
  AssetBlob,
  AssetBlobDocument,
} from '../assets/asset-blob.schema';
import { User, UserDocument } from '../auth/user.schema';

@Injectable()
export class ChatMetadataService {
  private readonly logger = new Logger(ChatMetadataService.name);

  constructor(
    @InjectModel(ChatMetadata.name)
    private readonly metaModel: Model<ChatMetadataDocument>,
    @InjectModel(Chat.name)
    private readonly chatModel: Model<ChatDocument>,
    @InjectModel(AssetBlob.name)
    private readonly assetBlobModel: Model<AssetBlobDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(
    userId: Types.ObjectId,
    dto: CreateChatMetadataDto,
  ): Promise<ChatMetadataDocument> {
    const doc = new this.metaModel({
      ...dto,
      userId,
      tools: dto.tools ?? [],
    });
    const saved = await doc.save();
    this.logger.log(`Created ChatMetadata id=${saved._id} user=${userId}`);
    return saved;
  }

  // ── Read all (for user) ───────────────────────────────────────────────────

  async findAll(userId: Types.ObjectId): Promise<ChatMetadataDocument[]> {
    const docs = await this.metaModel
      .find({ $or: [{ userId }, { sharedWith: userId }] })
      .select('-cryptoKey')
      .sort({ createdAt: -1 })
      .exec();
    return this.attachSharedUsernames(docs);
  }

  // ── Read one ──────────────────────────────────────────────────────────────

  async findOne(
    userId: Types.ObjectId,
    id: string,
  ): Promise<ChatMetadataDocument> {
    this.assertObjectId(id);
    const doc = await this.metaModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`ChatMetadata ${id} not found`);
    this.assertAccess(userId, doc);
    const [withUsernames] = await this.attachSharedUsernames([doc]);
    return withUsernames;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(
    userId: Types.ObjectId,
    id: string,
    dto: UpdateChatMetadataDto,
  ): Promise<ChatMetadataDocument> {
    this.assertObjectId(id);
    const doc = await this.metaModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`ChatMetadata ${id} not found`);
    this.assertOwner(userId, doc);

    Object.assign(doc, dto);
    await doc.save();
    this.logger.log(`Updated ChatMetadata id=${id}`);
    return doc;
  }

  async removeAssetFromChat(
    userId: Types.ObjectId,
    id: string,
    refId: Types.ObjectId,
  ): Promise<void> {
    const doc = await this.metaModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`ChatMetadata ${id} not found`);
    this.assertOwner(userId, doc);

    doc.generatedAssets = doc.generatedAssets?.filter(
      (asset) => asset.refId + '' !== refId + '',
    );
    await doc.save();
  }
  async setChatAssetVisibility(
    userId: Types.ObjectId,
    id: string,
    refId: Types.ObjectId,
    isVisible: boolean,
  ): Promise<void> {
    const doc = await this.metaModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`ChatMetadata ${id} not found`);
    this.assertOwner(userId, doc);

    doc.generatedAssets = doc.generatedAssets?.map((asset) => {
      if (asset.refId + '' === refId + '') asset.isVisible = isVisible;
      return asset;
    });

    await doc.save();
  }

  async addAssetToChat(
    userId: Types.ObjectId | string,
    id: string,
    asset: GeneratedAssetDto | GeneratedAsset,
    role: AssetRole = AssetRole.AI,
  ): Promise<ChatMetadataDocument> {
    this.assertObjectId(id);

    const doc = await this.metaModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`ChatMetadata ${id} not found`);
    this.assertOwner(userId, doc);

    const normalizedAsset: GeneratedAsset = (
      typeof asset.refId === 'string'
        ? {
            ...asset,
            refId: new Types.ObjectId(asset.refId),
          }
        : asset
    ) as GeneratedAsset;

    if (role === AssetRole.AI) {
      if (!doc.generatedAssets?.length) {
        doc.generatedAssets = [normalizedAsset];
      } else {
        doc.generatedAssets.push(normalizedAsset);
      }
    } else {
      if (!doc.userAssets?.length) {
        doc.userAssets = [normalizedAsset];
      } else {
        doc.userAssets.push(normalizedAsset);
      }
    }
    await doc.save();
    this.logger.log(`Updated Assets for ChatMetadata id=${id}`);
    return doc;
  }

  // ── Delete (cascade) ──────────────────────────────────────────────────────

  async remove(userId: Types.ObjectId, id: string): Promise<void> {
    this.assertObjectId(id);
    const doc = await this.metaModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`ChatMetadata ${id} not found`);
    this.assertOwner(userId, doc);

    // Cascade: delete all chat messages that reference this meta id
    const { deletedCount } = await this.chatModel
      .deleteMany({ chatInternalId: id })
      .exec();
    this.logger.log(
      `Cascade-deleted ${deletedCount} chats for ChatMetadata id=${id}`,
    );
    // Cascade: delete all images that reference this meta id
    const { deletedCount: deletedImages } = await this.assetBlobModel
      .deleteMany({ chatId: id })
      .exec();
    this.logger.log(
      `Cascade-deleted ${deletedImages} images for ChatMetadata id=${id}`,
    );

    await doc.deleteOne();
    this.logger.log(`Deleted ChatMetadata id=${id}`);
  }

  // ── Internal helper used by LmStudioService ───────────────────────────────

  /**
   * Create a ChatMetadata record and return its hex ObjectId string so
   * LmStudioService can stamp `chatInternalId` on each chat message.
   */
  async createAndReturnId(
    userId: Types.ObjectId,
    dto: CreateChatMetadataDto,
  ): Promise<string> {
    const doc = await this.create(userId, dto);
    return (doc._id as Types.ObjectId).toHexString();
  }

  // ── Sharing ───────────────────────────────────────────────────────────────

  async shareChat(
    ownerId: Types.ObjectId,
    id: string,
    username: string,
  ): Promise<ChatMetadataDocument> {
    this.assertObjectId(id);
    const doc = await this.metaModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`ChatMetadata ${id} not found`);
    this.assertOwner(ownerId, doc);

    const target = await this.userModel
      .findOne({ username: username.trim().toLowerCase() })
      .exec();
    if (!target) throw new NotFoundException(`User "${username}" not found`);
    if (target._id.equals(ownerId)) {
      throw new BadRequestException('You cannot share a chat with yourself');
    }

    const alreadyShared = doc.sharedWith?.some((id) => id.equals(target._id));
    if (!alreadyShared) {
      doc.sharedWith = [...(doc.sharedWith ?? []), target._id];
      await doc.save();
    }

    const [withUsernames] = await this.attachSharedUsernames([doc]);
    this.logger.log(`Shared ChatMetadata id=${id} with user=${target._id}`);
    return withUsernames;
  }

  async unshareChat(
    ownerId: Types.ObjectId,
    id: string,
    targetUserId: string,
  ): Promise<ChatMetadataDocument> {
    this.assertObjectId(id);
    const doc = await this.metaModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`ChatMetadata ${id} not found`);
    this.assertOwner(ownerId, doc);

    doc.sharedWith = (doc.sharedWith ?? []).filter(
      (uid) => !uid.equals(targetUserId),
    );
    await doc.save();

    const [withUsernames] = await this.attachSharedUsernames([doc]);
    this.logger.log(`Unshared ChatMetadata id=${id} from user=${targetUserId}`);
    return withUsernames;
  }

  /**
   * Internal, unguarded update used by the streaming code path (lock/touch).
   * Access is assumed to have already been checked via `findOne` earlier in
   * that call path — this never runs standalone from a controller route.
   */
  async touch(
    id: string,
    patch: Partial<Pick<ChatMetadata, 'lastMessageSentAt' | 'locked'>>,
  ): Promise<void> {
    await this.metaModel.findByIdAndUpdate(id, patch).exec();
  }

  private async attachSharedUsernames(
    docs: ChatMetadataDocument[],
  ): Promise<ChatMetadataDocument[]> {
    const allIds = docs.flatMap((d) => d.sharedWith ?? []);
    if (allIds.length === 0) return docs;

    const users = await this.userModel
      .find({ _id: { $in: allIds } })
      .select('username')
      .lean()
      .exec();
    const usernameById = new Map(
      users.map((u) => [u._id.toString(), u.username]),
    );

    for (const doc of docs) {
      const usernames = (doc.sharedWith ?? []).map(
        (uid) => usernameById.get(uid.toString()) ?? 'unknown',
      );
      // Plain property assignment on a Mongoose document is invisible to
      // toJSON()/toObject() (only schema paths + virtuals are serialized) —
      // `.set(..., { strict: false })` stores it in `_doc` so it actually
      // survives the HTTP response.
      doc.set('sharedWithUsernames', usernames, { strict: false });
    }
    return docs;
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  private assertOwner(
    userId: Types.ObjectId | string,
    doc: ChatMetadataDocument,
  ): void {
    const uId =
      typeof userId !== 'string' ? new Types.ObjectId(userId) : userId;
    if (!doc.userId.equals(uId)) {
      throw new ForbiddenException(
        'You do not have access to this chat metadata',
      );
    }
  }

  private assertAccess(
    userId: Types.ObjectId | string,
    doc: ChatMetadataDocument,
  ): void {
    const uId =
      typeof userId !== 'string' ? new Types.ObjectId(userId) : userId;
    const isOwner = doc.userId.equals(uId);
    const isShared = (doc.sharedWith ?? []).some((sid) => sid.equals(uId));
    if (!isOwner && !isShared) {
      throw new ForbiddenException(
        'You do not have access to this chat metadata',
      );
    }
  }

  private assertObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid id: ${id}`);
    }
  }

  async uploadAndAddAssetToChat(
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

    const mdl = await this.assetBlobModel.create({
      userId,
      chatId,
      filename,
      role,
      isVisible: true,
      mimeType,
      displayName: originalFilename,
      data,
      thumbnailData,
    });

    const res = { url: `assets/${chatId}/${filename}`, filename, id: mdl._id };
    const sizeKb = Math.round(data.byteLength / 1024);

    const assetUrl = `api/assets/${chatId}/${res.filename}`;
    await this.addAssetToChat(
      userId,
      chatId,
      {
        url: assetUrl,
        filename: originalFilename,
        refId: res.id,
        mimeType: mimeType,
        sizeKb,
        isVisible: true,
        type: GeneratedAssetType.FILE,
      },
      role,
    );

    return {
      sizeKb,
      assetUrl,
      filename: originalFilename,
      internalFilename: mdl.filename,
    };
  }
}
