import { computed, inject, Injectable, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, Subscription, switchMap } from 'rxjs';
import {
  OpenAiStreamService,
  McpCallProgressEvent,
} from './completions-openai-stream.service';
import { OpenAiStreamErrorEvent, OpenAiStreamApiInfoEvent } from './openai-stream-events.model';
import {
  ChatMetadataService,
  ChatMetadataDto,
  CreateChatMetadataDto,
  ReasoningDto,
} from '../../client';
import InvokeAiModelToUseEnum = ChatMetadataDto.InvokeAiModelToUseEnum;
import { AppendedFile } from './chat-input.component';
import * as CryptoJS from 'crypto-js';

export interface ChatMessage {
  role: 'user' | 'ai' | 'error' | 'info' | 'tool_call' | 'reasoning' | 'mcp_list_tools';
  text: string;
  image?: string;
  date?: Date;
  stats?: string;
  streaming?: boolean;
  toolName?: string;
  toolArguments?: object;
  toolOutput?: string;
  toolFailed?: boolean;
  providerLabel?: string;
  collapsed?: boolean;
  username?: string;
  itemId?: string; // track by OpenAI item id
}

@Injectable()
export class ChatCompletionsService {
  private readonly streamService = inject(OpenAiStreamService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly chatMetaService = inject(ChatMetadataService);
  readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    input: ['', [Validators.required, Validators.minLength(1)]],
  });

  readonly streaming = signal(false);
  readonly chatMessages = signal<ChatMessage[]>([]);
  readonly currentChatId = signal<string | null>(null);

  /** True while this chat is locked server-side (another user's prompt is streaming). */
  readonly locked = signal(false);

  private readonly lastUserInput = signal<string>('');
  private sub?: Subscription;
  private lockPollSub?: Subscription;

  readonly showResend = computed(() => {
    const msgs = this.chatMessages();
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'info') return false;
    return !!this.lastUserInput();
  });

  readonly hasChatOpen = computed(() => this.currentChatId() !== null);

  toggleCollapsed(index: number): void {
    this.chatMessages.update((msgs) => {
      const copy = [...msgs];
      copy[index] = { ...copy[index], collapsed: !copy[index].collapsed };
      return copy;
    });
  }

  lastIndexWhere(msgs: ChatMessage[], pred: (m: ChatMessage) => boolean): number {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (pred(msgs[i])) return i;
    }
    return -1;
  }

  patchLast(pred: (m: ChatMessage) => boolean, patch: Partial<ChatMessage>): void {
    this.chatMessages.update((msgs) => {
      const idx = this.lastIndexWhere(msgs, pred);
      if (idx === -1) return msgs;
      const copy = [...msgs];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  patchByItemId(itemId: string, patch: Partial<ChatMessage>): void {
    this.chatMessages.update((msgs) => {
      const idx = this.lastIndexWhere(msgs, (m) => m.itemId === itemId);
      if (idx === -1) return msgs;
      const copy = [...msgs];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  submit(
    selectedModelId: string,
    reasoning: ReasoningDto.EffortEnum | undefined,
    appendedFiles: AppendedFile[] | undefined,
    encryptionKey: string | undefined,
    onChatListRefresh: () => void,
    newChatOptions?: {
      name?: string;
      letAiDecideChatName?: boolean;
      useCrypto?: boolean;
      cryptoKey?: string;
      openAiEndpointPreference?: CreateChatMetadataDto.OpenAiEndpointPreferenceEnum;
      useInvoke?: boolean;
      invokeAiModelToUse?: InvokeAiModelToUseEnum;
      mcpOverrides?: Array<{ mcpId: string; active: boolean; allowedTools: string[] }>;
    },
  ): void {
    if (this.form.invalid || this.streaming() || this.locked()) return;
    let input = this.form.getRawValue().input!.trim();

    this.lastUserInput.set(input);
    this.form.reset();
    this.streaming.set(true);

    for (const f of appendedFiles ?? []) {
      if (f.image_url) {
        this.chatMessages.update((msgs) => [
          ...msgs,
          { role: 'user', text: '', image: f.image_url, date: new Date(), username: 'You' },
        ]);
      }
    }

    this.chatMessages.update((msgs) => [
      ...msgs,
      {
        role: 'user',
        username: 'You',
        text:
          (appendedFiles
            ?.map((f) =>
              f.type === 'input_image'
                ? undefined
                : `::file[${f.filename}](${f.assetUrl}){size=${f.sizeKb} type=${f.filename.split('.')[1]}}`,
            )
            .filter((f) => !!f)
            .join('\n') ?? '') +
          (appendedFiles?.length ? '  \n' : '') +
          input,
        date: new Date(),
      },
    ]);

    this.streamService.reset();
    this.sub?.unsubscribe();

    this.sub = this.streamService.events$.subscribe({
      next: (event) => {
        switch ((event as any).type) {
          // ── MCP tool call progress ─────────────────────────────────────────
          case 'response.mcp_call.in_progress': {
            const e = event as McpCallProgressEvent;
            this.chatMessages.update((msgs) => [
              ...msgs,
              {
                role: 'tool_call',
                text: '',
                streaming: true,
                collapsed: false,
                date: new Date(),
                toolName: e.name,
                toolArguments: e.arguments,
              },
            ]);
            break;
          }

          case 'response.mcp_call.completed': {
            const e = event as McpCallProgressEvent;
            this.chatMessages.update((msgs) => {
              const idx = this.lastIndexWhere(
                msgs,
                (m) => m.role === 'tool_call' && m.toolName === e.name && !!m.streaming,
              );
              if (idx === -1) return msgs;
              const copy = [...msgs];
              copy[idx] = {
                ...copy[idx],
                streaming: false,
                collapsed: true,
                toolArguments: e.arguments ?? copy[idx].toolArguments,
                toolOutput: e.output,
              };
              return copy;
            });
            break;
          }

          // ── Stream errors ─────────────────────────────────────────────────
          case 'error': {
            const e = event as OpenAiStreamErrorEvent;
            this.chatMessages.update((msgs) => {
              const filtered = msgs[msgs.length - 1]?.streaming ? msgs.slice(0, -1) : msgs;
              return [
                ...filtered,
                {
                  role: 'error' as const,
                  text: e.message ?? e.error?.message ?? 'Unknown error',
                  date: new Date(),
                },
              ];
            });
            this.streaming.set(false);
            break;
          }

          case 'api.info': {
            const e = event as OpenAiStreamApiInfoEvent;
            this.chatMessages.update((msgs) => {
              const filtered = msgs[msgs.length - 1]?.streaming ? msgs.slice(0, -1) : msgs;
              return [...filtered, { role: 'info' as const, text: e.message, date: new Date() }];
            });
            break;
          }
        }
      },
      complete: () => this.streaming.set(false),
      error: () => this.streaming.set(false),
    });

    // Reasoning deltas — lazily create the bubble on first delta.
    this.streamService.reasoningDelta$.subscribe((chunk) => {
      this.chatMessages.update((msgs) => {
        const idx = this.lastIndexWhere(msgs, (m) => m.role === 'reasoning' && !!m.streaming);
        if (idx !== -1) {
          const copy = [...msgs];
          copy[idx] = { ...copy[idx], text: copy[idx].text + chunk };
          return copy;
        }
        return [
          ...msgs,
          { role: 'reasoning', text: chunk, streaming: true, collapsed: false, date: new Date() },
        ];
      });
    });

    // Text deltas — lazily create the ai bubble on first delta.
    this.streamService.messageDelta$.subscribe((chunk) => {
      this.chatMessages.update((msgs) => {
        const idx = this.lastIndexWhere(msgs, (m) => m.role === 'ai' && !!m.streaming);
        if (idx !== -1) {
          const copy = [...msgs];
          copy[idx] = { ...copy[idx], text: copy[idx].text + chunk };
          return copy;
        }
        return [
          ...msgs,
          { role: 'ai', text: chunk, streaming: true, date: new Date(), username: selectedModelId },
        ];
      });
    });

    this.streamService.chatEnd$.subscribe(() => {
      this.chatMessages.update((msgs) =>
        msgs.map((m) => {
          if (m.role === 'ai' && m.streaming) return { ...m, streaming: false };
          if (m.role === 'reasoning' && m.streaming) {
            return { ...m, streaming: false, collapsed: true };
          }
          if (m.role === 'tool_call' && m.streaming) {
            return { ...m, streaming: false, collapsed: true };
          }
          return m;
        }),
      );
      onChatListRefresh();
    });

    this.streamService.newChatCreated$.subscribe((result) => {
      if (this.currentChatId() !== result) {
        this.currentChatId.set(result);
        this.location.replaceState(`/chat-openai/${result}`);
      }
    });

    this.streamService.chat(
      {
        model: selectedModelId,
        messages: [
          {
            role: 'user',
            content: [...this.buildAttachmentParts(appendedFiles), { type: 'text', text: input }],
          },
        ],
        reasoning_effort: reasoning as any,
        stream: true,
      },
      this.currentChatId() ?? undefined,
      this.currentChatId() ? undefined : newChatOptions,
    );
  }

  /** Converts appended files into Chat Completions content parts. Images go through
   * as `image_url` parts; other files are referenced by URL since most local models
   * don't support arbitrary file content parts over Chat Completions. */
  private buildAttachmentParts(appendedFiles: AppendedFile[] | undefined): any[] {
    if (!appendedFiles?.length) return [];
    return appendedFiles.map((file) => {
      if (file.type === 'input_image' && file.image_url) {
        return { type: 'image_url', image_url: { url: file.image_url } };
      }
      return { type: 'text', text: `[Attached file: ${file.filename}] (${file.assetUrl ?? ''})` };
    });
  }

  resend(
    selectedModelId: string,
    reasoning: ReasoningDto.EffortEnum | undefined,
    appendedFiles: AppendedFile[] | undefined,
    encryptionKey: string | undefined,
    onChatListRefresh: () => void,
  ): void {
    const input = this.lastUserInput();
    if (!input || this.streaming()) return;
    this.form.setValue({ input });
    this.submit(selectedModelId, reasoning, appendedFiles, encryptionKey, onChatListRefresh);
  }

  reset(): void {
    this.sub?.unsubscribe();
    this.streamService.reset();
    this.streaming.set(false);
    this.chatMessages.update((msgs) => msgs.filter((m) => !m.streaming));
  }

  destroy(): void {
    this.sub?.unsubscribe();
    this.stopLockPolling();
  }

  /**
   * Starts/stops polling this chat's lock status. Only shared chats poll —
   * non-shared chats have no other writer who could lock them, so polling
   * would be pure overhead.
   */
  updateLockPolling(chatId: string, isShared: boolean, onUnlocked?: () => void): void {
    this.stopLockPolling();
    if (!isShared) {
      this.locked.set(false);
      return;
    }
    this.lockPollSub = interval(3000)
      .pipe(switchMap(() => this.chatMetaService.getChatMetadata(chatId)))
      .subscribe({
        next: (meta) => {
          const isLocked = !!meta.locked;
          const wasLocked = this.locked();
          this.locked.set(isLocked);
          // Lock just released: the other user's turn finished streaming, so
          // pull in whatever they added while we were watching.
          if (wasLocked && !isLocked) onUnlocked?.();
        },
        error: () => this.stopLockPolling(),
      });
  }

  stopLockPolling(): void {
    this.lockPollSub?.unsubscribe();
    this.lockPollSub = undefined;
    this.locked.set(false);
  }
}
