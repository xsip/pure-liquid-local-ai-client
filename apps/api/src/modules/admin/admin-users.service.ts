import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../auth/user.schema';
import { Role } from '../auth/roles.decorator';
import { SubscriptionType } from '../auth/user.schema';
import { TokenLimitService } from '../token-limit/token-limit.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { AdminUserDto } from './dto/admin-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly tokenLimitService: TokenLimitService,
  ) {}

  async findAll(): Promise<AdminUserDto[]> {
    const docs = await this.userModel
      .find()
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((d) => this.toDto(d));
  }

  async findById(id: string): Promise<AdminUserDto> {
    this.assertObjectId(id);
    const doc = await this.userModel
      .findById(id)
      .select('-passwordHash')
      .lean()
      .exec();
    if (!doc) throw new NotFoundException(`User "${id}" not found`);
    return this.toDto(doc);
  }

  async create(dto: CreateAdminUserDto): Promise<AdminUserDto> {
    const username = dto.username.toLowerCase();
    const existing = await this.userModel.findOne({ username }).exec();
    if (existing) {
      throw new ConflictException(`Username "${dto.username}" is already registered`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const doc = await this.userModel.create({
      username,
      passwordHash,
      role: dto.role ?? Role.User,
      subscription: dto.subscription ?? SubscriptionType.FREE,
      isActivated: dto.isActivated ?? true,
    });
    return this.toDto(doc.toObject());
  }

  async update(id: string, dto: UpdateAdminUserDto): Promise<AdminUserDto> {
    this.assertObjectId(id);
    const doc = await this.userModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`User "${id}" not found`);

    if (dto.password) doc.passwordHash = await bcrypt.hash(dto.password, 12);
    if (dto.role !== undefined) doc.role = dto.role;
    if (dto.subscription !== undefined) doc.subscription = dto.subscription;
    if (dto.isActivated !== undefined) doc.isActivated = dto.isActivated;

    await doc.save();
    return this.toDto(doc.toObject());
  }

  async remove(id: string): Promise<void> {
    this.assertObjectId(id);
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`User "${id}" not found`);
  }

  async resetTokens(id: string): Promise<AdminUserDto> {
    this.assertObjectId(id);
    const updated = await this.tokenLimitService.resetTokenLimit(
      new Types.ObjectId(id),
    );
    return this.toDto(updated.toObject());
  }

  private assertObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid id: ${id}`);
    }
  }

  private toDto(doc: any): AdminUserDto {
    return {
      _id: doc._id.toString(),
      username: doc.username,
      role: doc.role,
      subscription: doc.subscription,
      isActivated: doc.isActivated,
      usedTokens: doc.usedTokens ?? 0,
      tokenCountResetDate: doc.tokenCountResetDate ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
