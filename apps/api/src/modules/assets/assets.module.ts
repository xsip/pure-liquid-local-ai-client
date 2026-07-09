import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetsController } from './assets.controller';
import { AssetBlob, AssetBlobSchema } from './asset-blob.schema';
import { AssetsService } from './assets.service';
import { ChatMetadataModule } from '../chat-metadata/chat-metadata.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssetBlob.name, schema: AssetBlobSchema },
    ]),
    ChatMetadataModule,
  ],
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}
