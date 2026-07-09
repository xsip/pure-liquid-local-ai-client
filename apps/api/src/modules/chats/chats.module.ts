import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chat, ChatSchema } from './chat.schema';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { ChatMetadataService } from '../chat-metadata/chat-metadata.service';
import {
  ChatMetadata,
  ChatMetadataSchema,
} from '../chat-metadata/chat-metadata.schema';
import { AssetBlob, AssetBlobSchema } from '../assets/asset-blob.schema';
import { User, UserSchema } from '../auth/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: ChatMetadata.name, schema: ChatMetadataSchema },
      { name: AssetBlob.name, schema: AssetBlobSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatMetadataService],
  exports: [ChatsService], // exported so LmStudioModule can inject it
})
export class ChatsModule {}
