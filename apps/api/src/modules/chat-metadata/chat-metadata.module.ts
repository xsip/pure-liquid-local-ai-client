import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMetadata, ChatMetadataSchema } from './chat-metadata.schema';
import { ChatMetadataService } from './chat-metadata.service';
import { ChatMetadataController } from './chat-metadata.controller';
import { Chat, ChatSchema } from '../chats/chat.schema';
import { AssetBlob, AssetBlobSchema } from '../assets/asset-blob.schema';
import { User, UserSchema } from '../auth/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMetadata.name, schema: ChatMetadataSchema },
      // Needed for cascade delete of chat messages
      { name: Chat.name, schema: ChatSchema },
      // Needed for cascade delete of chat images
      { name: AssetBlob.name, schema: AssetBlobSchema },
      // Needed to resolve usernames for sharing
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ChatMetadataController],
  providers: [ChatMetadataService],
  exports: [ChatMetadataService], // exported so LmStudioModule can inject it
})
export class ChatMetadataModule {}
