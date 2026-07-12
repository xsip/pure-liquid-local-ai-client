import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatsModule } from '../chats/chats.module';
import { ChatMetadataModule } from '../chat-metadata/chat-metadata.module';
import { TokenLimitModule } from '../token-limit/token-limit.module';
import { McpClientModule } from '../mcp-client/mcp-client.module';
import { OpenaiController } from './openai.controller';
import { OpenAiService } from './openai.service';
import { OpenAiResponseService } from './open-ai-response.service';
import { ActiveGenerationService } from './active-generation.service';
import { ToolApprovalService } from './tool-approval.service';

@Module({
  imports: [
    HttpModule,
    ChatsModule,
    ChatMetadataModule,
    TokenLimitModule,
    McpClientModule,
  ],
  controllers: [OpenaiController],
  providers: [
    OpenAiService,
    OpenAiResponseService,
    ActiveGenerationService,
    ToolApprovalService,
  ],
  exports: [OpenAiResponseService, ActiveGenerationService],
})
export class OpenaiModule {}
