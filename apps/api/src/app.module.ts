import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppService } from './app.service';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { ApiTools } from './tools/api.tools';
import { ChatsModule } from './modules/chats/chats.module';
import { ChatMetadataModule } from './modules/chat-metadata/chat-metadata.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/api-key.guard';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './modules/auth/roles.guard';
import { TokenLimitModule } from './modules/token-limit/token-limit.module';
import { OpenaiModule } from './modules/openai/openai.module';
import { InvokeModule } from './modules/invoke/invoke.module';
import { HttpModule } from '@nestjs/axios';
import { AssetsModule } from './modules/assets/assets.module';
import { toolsTimeoutMiddleware } from './tools/tools-timeout.middleware';
import { ToolsHelperService } from './tools/tools-helper.service';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: './.env' }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>(
          'MONGODB_URI',
          'mongodb://localhost:27017/lmStudioWrapper',
        ),
      }),
    }),
    AuthModule,

    AssetsModule,
    McpModule.forRoot({
      name: 'pure-liquid-local-ai-client-toolbox',
      version: '1.0.0',
      apiPrefix: 'tools',
      transport: [McpTransportType.STREAMABLE_HTTP, McpTransportType.SSE],
      streamableHttp: {
        enableJsonResponse: true,
      },
    }),
    HttpModule,
    OpenaiModule,
    ChatsModule,
    ChatMetadataModule,
    TokenLimitModule,
    AdminModule,
    InvokeModule.forRoot('http://127.0.0.1:9090'),
  ],
  controllers: [],
  providers: [
    AppService,
    ToolsHelperService,
    ApiTools,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(toolsTimeoutMiddleware).forRoutes('tools');
  }
}
