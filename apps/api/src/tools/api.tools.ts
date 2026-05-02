import { Injectable } from '@nestjs/common';
import { Context, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { SubscriptionType, User } from '../modules/auth/user.schema';
import { TokenLimitService } from '../modules/token-limit/token-limit.service';
import type { Request } from 'express';
import dayjs from 'dayjs';
import { ChatMetadataService } from '../modules/chat-metadata/chat-metadata.service';
import { Types } from 'mongoose';
import * as CryptoJS from 'crypto-js';
import { InvokeService } from '../modules/invoke/invoke.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AssetsService } from '../modules/assets/assets.service';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { ApiEvent, ToolsHelperService } from './tools-helper.service';
import { GeneratedAssetType } from '../modules/chat-metadata/chat-metadata.schema';
import JSZip from 'jszip';

@Injectable()
export class ApiTools {
  constructor(
    private readonly tokenLimitService: TokenLimitService,
    private readonly chatMetaDataService: ChatMetadataService,
    private readonly invokeService: InvokeService,
    private readonly httpService: HttpService,
    private readonly assetsService: AssetsService,
    private readonly configService: ConfigService,
    private readonly toolsHelperService: ToolsHelperService,
  ) {}

  @Tool({
    name: 'greeting-tool',
    description: 'Returns a greeting with progress updates',
    parameters: z.object({
      name: z.string().default('World'),
    }),
  })
  async sayHello({ name }, context: Context, request: Request) {
    let progress = 0;
    await new Promise((resolve) => {
      setInterval(() => {
        if (progress === 100) {
          resolve(true);
          return;
        }
        progress++;
        this.toolsHelperService.emitApiEvent(request, ApiEvent.MCP_PROGRESS, {
          progress,
          message: crypto
            .createHash('md5')
            .update(crypto.randomBytes(32))
            .digest('hex'),
        });
      }, 40);
    });
    return `Hello2, ${name}!`;
  }

  @Tool({
    name: 'generate-zip-from-file-ids',
    description: 'Generates a zip from chats file ids',
    parameters: z.object({
      fileIds: z.array(z.string()),
      zipFileName: z.string(),
    }),
  })
  async generateZipFromFileIds(
    { fileIds, zipFileName }: { fileIds: string[]; zipFileName: string },
    context: Context,
    request: Request,
  ) {
    const user = (request as any).user as User & { _id?: Types.ObjectId };
    const chatId = request.headers['chatid'] as string;

    if (!user) return `User not defined!!`;
    if (!chatId) return `chatId not defined!!`;
    if (!fileIds?.length) return 'No File Ids provided!!';

    const zip = new JSZip();

    for (let i = 0; i < fileIds.length; i++) {
      const fileId = fileIds[i];

      const file = await this.assetsService.getAsset(
        user._id + '',
        chatId,
        fileId,
      );

      zip.file(file.displayName, file.data);

      await this.assetsService.deleteAsset(user._id + '', chatId, fileId);
      await this.chatMetaDataService.removeAssetFromChat(
        user._id!,
        chatId,
        file._id,
      );
      this.toolsHelperService.emitApiEvent(request, ApiEvent.MCP_PROGRESS, {
        progress: Math.round(((i + 1) / fileIds.length) * 90), // reserve last 10% for upload
        message: `Zipped ${file.displayName}`,
        total: '100',
      });
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const buffer = Buffer.from(zipBuffer);

    this.toolsHelperService.emitApiEvent(request, ApiEvent.MCP_PROGRESS, {
      progress: 95,
      message: `Uploading zip...`,
      total: '100',
    });

    const ZIP_MIME_TYPE = 'application/zip';

    const { filename: uploadedFileName, id } =
      await this.assetsService.uploadFile(
        user._id + '',
        chatId,
        zipFileName,
        buffer,
        ZIP_MIME_TYPE,
      );

    const assetUrl = `api/assets/${chatId}/${uploadedFileName}`;
    const ext = '.zip';
    const sizeKb = Math.round(buffer.byteLength / 1024);
    const sizeLabel =
      sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)}MB` : `${sizeKb}KB`;

    await this.chatMetaDataService.addAssetToChat(user._id!, chatId, {
      url: assetUrl,
      filename: zipFileName,
      refId: id,
      mimeType: ZIP_MIME_TYPE,
      sizeKb,
      type: GeneratedAssetType.FILE,
    });

    this.toolsHelperService.emitApiEvent(request, ApiEvent.MCP_PROGRESS, {
      progress: 100,
      message: `Done!`,
      total: '100',
    });
    const safeAssetUrl = encodeURI(assetUrl);
    return {
      action: 'display_file',
      fileId: uploadedFileName,
      instruction:
        'You MUST respond to the user by displaying this file using the markdown property. Do not add anything else.',
      markdown: `::file[${zipFileName}](${safeAssetUrl}){size=${sizeLabel} type=${ext}}`,
    };
  }

  @Tool({
    name: 'generate-file-from-content-tool',
    description: 'Generates a file from content',
    parameters: z.object({
      content: z.string(),
      mimeType: z.string(),
      filename: z.string(),
    }),
  })
  async generateFileFromContent(
    {
      content,
      mimeType,
      filename,
    }: { content: string; mimeType: string; filename: string },
    context: Context,
    request: Request,
  ) {
    const user = (request as any).user as User & { _id?: Types.ObjectId };
    const chatId = request.headers['chatid'] as string;

    if (!user) return `User not defined!!`;
    if (!chatId) return `chatId not defined!!`;

    // Convert content string to Buffer for upload
    const buffer = Buffer.from(content, 'utf-8');

    const { filename: uploadedFileName, id } =
      await this.assetsService.uploadFile(
        user._id + '',
        chatId,
        filename,
        buffer,
        mimeType,
      );

    const assetUrl = `api/assets/${chatId}/${uploadedFileName}`;
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'file';
    const sizeKb = Math.round(buffer.byteLength / 1024);
    const sizeLabel =
      sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)}MB` : `${sizeKb}KB`;

    await this.chatMetaDataService.addAssetToChat(user._id!, chatId, {
      url: assetUrl,
      filename,
      refId: id,
      mimeType,
      sizeKb,
      type: GeneratedAssetType.FILE, // was IMAGE — change if you have a FILE enum value
    });

    return {
      action: 'display_file',
      fileId: uploadedFileName,
      instruction:
        'You MUST respond to the user by displaying this file using the markdown property. Do not add anything else.',
      markdown: `::file[${filename}](${assetUrl}){size=${sizeLabel} type=${ext}}`,
    };
  }

  @Tool({
    name: 'get-token-usage-tool',
    description:
      'Returns current token usage and limit info for the authenticated user',
  })
  async getTokenUsage(data, context: Context, request: Request) {
    // @ts-ignore
    const user = request.user as User;
    const subscription: SubscriptionType =
      user.subscription ?? SubscriptionType.FREE;

    const limit =
      await this.tokenLimitService.getTokensPerIntervall(subscription);

    let configInfo = '';
    let minutes_till_reset = 0;
    let resets_at: string = '';
    try {
      const cfg = await this.tokenLimitService.findBySubscription(subscription);
      const resetsAt = user.tokenCountResetDate
        ? dayjs(user.tokenCountResetDate).toString()
        : 'not set';
      configInfo = ` Limit resets every ${cfg.minutesTillReset} minute(s). Next reset: ${resetsAt}.`;
      minutes_till_reset = cfg.minutesTillReset;
      resets_at = resetsAt;
    } catch {
      // config not found in DB — skip extra info
    }

    return {
      used_tokens: user.usedTokens ?? 0,
      max_tokens: limit,
      reset_interval_minutes: minutes_till_reset,
      minutes_till_reset,
      subscription,
      next_reset: resets_at,
    };
    /*
    return (
      `You used ${user.usedTokens ?? 0} tokens out of ${limit} tokens ` +
      `(subscription: ${subscription}).${configInfo}`
    );*/
  }

  @Tool({
    name: 'decrypt-message-tool',
    description:
      'Decrypts a user message. MUST receive the full, exact, unmodified user input',
    parameters: z.object({
      full_user_message: z.string().default('Test'),
    }),
  })
  async decryptMessage(
    { full_user_message }: { full_user_message: string },
    context: Context,
    request: Request,
  ) {
    // @ts-ignore
    const user = request.user as User;
    const chatId = request.headers['chatid'] as string;

    if (!full_user_message) {
      return `Didnt receive any message to decrypt!`;
    }

    try {
      const chatMetaData = await this.chatMetaDataService.findOne(
        (user as any)._id as Types.ObjectId,
        chatId,
      );

      if (!chatMetaData) {
        return `Sorry, but chat with id ${chatId} not found.`;
      }

      if (!chatMetaData.useCrypto) return `This chat doesnt use encryption!`;

      if (!chatMetaData.cryptoKey)
        return `UseCrypto is true, but crypto key not set. Can't decrypt!`;

      return CryptoJS.AES.decrypt(
        full_user_message,
        chatMetaData.cryptoKey,
      )?.toString(CryptoJS.enc.Utf8);
    } catch (e: any) {
      return `There was an error decrypting your message!!`;
    }
  }
  @Tool({
    name: 'get-image-tool',
    description:
      'Returns a image by url. You can use that to view and/or describe the image',
    parameters: z.object({
      url: z.string().default(''),
    }),
  })
  async getImageTool(
    { url }: { url: string },
    context: Context,
    request: Request,
  ) {
    const mimeTypeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
    };

    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = mimeTypeMap[ext] ?? 'image/png';

    const imageResponse = await firstValueFrom(
      this.httpService.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        headers: {
          Authorization: `Bearer ${request.headers['authorization']}`,
        },
      }),
    );

    const base64 = Buffer.from(imageResponse.data).toString('base64');

    return [
      {
        type: 'image',
        mimeType,
        data: base64,
      },
    ];
  }
  @Tool({
    name: 'generate-image-tool',
    description: 'Generates an image with the users prompt',
    parameters: z.object({
      prompt: z.string().default('Generate an image of a dog'),
    }),
  })
  async generateImage(
    { prompt }: { prompt: string },
    context: Context,
    request: Request,
  ) {
    const useInvoke =
      this.configService.get<string>('INVOKE_INTEGRATION') === 'true';
    if (!useInvoke) {
      return 'Invoke integration is not enabled. Tell the user to Make sure to set "INVOKE_INTEGRATION" to true in .env when starting LMStudio Extender!';
    }
    const user = (request as any).user as User & { _id?: Types.ObjectId };
    const chatId = request.headers['chatid'] as string;

    if (!user) return `User not defined!!`;
    if (!chatId) return `chatId not defined!!`;
    if (!prompt) return `Didn't receive any prompt!`;

    const chatMetaData = await this.chatMetaDataService.findOne(
      (user as any)._id as Types.ObjectId,
      chatId,
    );

    if (!chatMetaData) {
      return `Sorry, but chat with id ${chatId} not found.`;
    }

    if (
      !chatMetaData.useInvoke ||
      (chatMetaData.useInvoke && !chatMetaData.invokeAiModelToUse)
    ) {
      return 'Invoke integration is not enabledFor this session!';
    }
    const img = await this.invokeService.generateImage(
      prompt,
      chatMetaData.invokeAiModelToUse,
      (progress) => {
        if (progress !== undefined && progress.percentage) {
          this.toolsHelperService.emitApiEvent(request, ApiEvent.MCP_PROGRESS, {
            progress: progress.percentage * 100,
            message: progress.message,
          });
        }
      },
    );

    const fileName =
      img.fullPath
        .split('/')
        .reverse()
        .find((segment) => segment.includes('.')) ?? 'image.png';

    const imageResponse = await firstValueFrom(
      this.httpService.get<ArrayBuffer>(img.fullPath, {
        responseType: 'arraybuffer',
      }),
    );

    const thumbImageResponse = await firstValueFrom(
      this.httpService.get<ArrayBuffer>(img.thumbPath, {
        responseType: 'arraybuffer',
      }),
    );

    const mimeType =
      (imageResponse.headers['content-type'] as string)?.split(';')[0].trim() ??
      (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')
        ? 'image/jpeg'
        : 'image/png');

    const buffer = Buffer.from(imageResponse.data);
    const thumbnailBuffer = Buffer.from(thumbImageResponse.data);

    // Upload via assetsService, same as the REST endpoint
    const { filename, id } = await this.assetsService.uploadFile(
      user._id + '',
      chatId,
      fileName,
      buffer,
      mimeType,
      thumbnailBuffer,
    );

    await this.chatMetaDataService.addAssetToChat(user._id!, chatId, {
      url: `api/assets/${chatId}/${filename}`,
      thumbnail: `api/assets/${chatId}/${filename}?thumbnail=true`,
      filename,
      refId: id,
      type: GeneratedAssetType.IMAGE,
    });
    return [
      {
        content: JSON.stringify({
          action: 'display_image',
          instruction:
            'You MUST respond to the user by displaying this image as HTML. Do not stop.',
          markdown: `![image](api/assets/${chatId}/${filename}?thumbnail=true)`,
          html: `<img data-auth-src="api/assets/${chatId}/${filename}?thumbnail=true" src="" alt="${filename}"/>`,
          url: `api/assets/${chatId}/${filename}?thumbnail=true`,
        }),
      },
    ];
  }
}
