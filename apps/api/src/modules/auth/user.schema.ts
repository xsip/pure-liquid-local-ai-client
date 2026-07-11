import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from './roles.decorator';
import { CustomMcpDto } from './dto/custom-mcp.dto';

export type UserDocument = User & Document;

export enum SubscriptionType {
  FREE = 'free',
  BASIC = 'basic',
}

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  /** User role — drives access-control via RolesGuard */
  @Prop({ required: true, enum: Object.values(Role), default: Role.User })
  role: Role;

  /** Whether the user has activated their account via the activation link */
  @Prop({ required: true, default: false })
  isActivated: boolean;

  /**
   * Subscription tier — a free-form string, not restricted to SubscriptionType.
   * New tiers are created via TokenLimitConfig documents in the admin CMS;
   * SubscriptionType only documents the two built-in defaults.
   */
  @Prop({
    required: true,
    type: String,
    default: SubscriptionType.FREE,
  })
  subscription: string;

  /** MD5-based random hash sent to the user to activate their account */
  @Prop({ required: false, default: null, type: String })
  activationHash: string | null;

  @Prop({ required: false, default: null, type: Number })
  usedTokens: number;

  @Prop({ required: false, default: null, type: Date })
  tokenCountResetDate: Date;

  /** Custom MCP servers the user registered on their account. */
  @Prop({ required: false, default: [], type: [Object] })
  customMcps: CustomMcpDto[];
}

export const UserSchema = SchemaFactory.createForClass(User);
