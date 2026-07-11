import { computed, inject, Injectable, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, Subscription, switchMap } from 'rxjs';
import {
  McpCallProgressEvent,
  McpReportProgressEvent,
  OpenAiStreamService,
} from './completions-openai-stream.service';
import { OpenAiStreamApiInfoEvent, OpenAiStreamErrorEvent } from './openai-stream-events.model';
import { ChatMetadataDto, ChatMetadataService, CreateChatMetadataDto, ReasoningEffort } from '../../client';
import { AppendedFile } from './chat-input.component';
import InvokeAiModelToUseEnum = ChatMetadataDto.InvokeAiModelToUseEnum;

export interface ChatMessage {
  role: 'user' | 'ai' | 'error' | 'info' | 'tool_call' | 'reasoning' | 'mcp_list_tools';
  text: string;
  image?: string;
  /** Data URL (audio/wav base64) for a recorded voice message. */
  audio?: string;
  /** True when `audio` was transcribed server-side and should stay hidden
   * behind its transcript (shown as `text`) instead of an audio player. */
  audioHidden?: boolean;
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
  progress?: number;
  total?: number;
  progressMessage?: string;
  itemId?: string; // track by OpenAI item id
}

@Injectable()
export class ChatCompletionsService {
  private readonly streamService = inject(OpenAiStreamService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly chatMetaService = inject(ChatMetadataService);
  readonly fb = inject(FormBuilder);

  // No required validator — a message can be audio/file-only with empty text.
  // submit() itself still refuses to send if there's neither text nor attachments.
  readonly form = this.fb.group({
    input: [''],
  });

  readonly streaming = signal(false);
  readonly chatMessages = signal<ChatMessage[]>([]);
  readonly currentChatId = signal<string | null>(null);

  /** True while this chat is locked server-side (another user's prompt is streaming). */
  readonly locked = signal(false);

  /** True while we're watching a generation we didn't just submit ourselves —
   * resumed after a refresh, or a shared chat's owner currently typing. Shown
   * as "AI is generating a response…" rather than the generic lock message. */
  readonly generating = signal(false);

  private readonly lastUserInput = signal<string>('');
  private sub?: Subscription;
  private lockPollSub?: Subscription;
  /** All subscriptions wired per-generation (submit/resume) — torn down and
   * recreated on every call so they never accumulate duplicates across
   * multiple submits/resumes within the same component lifetime. */
  private streamSubs: Subscription[] = [];

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
    reasoning: ReasoningEffort | undefined,
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
      transcribeAudio?: boolean;
      mcpOverrides?: Array<{ mcpId: string; active: boolean; allowedTools: string[] }>;
    },
  ): void {
    let input = (this.form.getRawValue().input ?? '').trim();
    if ((!input && !appendedFiles?.length) || this.streaming() || this.locked()) return;

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
      if (f.type === 'input_audio' && f.audio_url) {
        this.chatMessages.update((msgs) => [
          ...msgs,
          { role: 'user', text: '', audio: f.audio_url, date: new Date(), username: 'You' },
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
              f.type === 'input_image' || f.type === 'input_audio'
                ? undefined
                : `::file[${f.filename}](${f.assetUrl}){size=${f.sizeKb} type=${f.filename.split('.')[1]}}`,
            )
            .filter((f) => !!f)
            .join('\n') ?? '') +
          (appendedFiles?.length ? '  \n' : '') +
          input ? input : '',
        date: new Date(),
      },
    ]);

    this.streamService.reset();
    this.wireStreamSubscriptions(selectedModelId, onChatListRefresh);

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

  /**
   * Reconnects to a generation already in-flight for `chatId` — used when the
   * chat was found locked as soon as its metadata loaded (e.g. the page was
   * refreshed while a response was still streaming). Replays the user's turn
   * and everything the model has produced so far, then keeps receiving live
   * chunks exactly like a freshly-submitted message.
   */
  resumeStreaming(chatId: string, modelName: string, onChatListRefresh: () => void): void {
    if (this.streaming()) return;
    this.streaming.set(true);
    this.locked.set(true);
    this.generating.set(true);

    this.streamService.reset();
    this.wireStreamSubscriptions(modelName, onChatListRefresh);

    // Only relevant for resume — a fresh submit() already pushed its own user
    // bubble locally, so wiring this into the shared subscriptions would
    // double it up. The echo is buffered/sent first server-side, but if it
    // ever lands after the first reasoning/content delta anyway (e.g. a slow
    // metadata lookup on the resume request), insert it right before that
    // delta's bubble rather than at the array's end — otherwise the AI's
    // response would render above the user message that prompted it.
    this.streamSubs.push(this.streamService.userMessageEcho$.subscribe((messages) => {
      const userMessages = (messages ?? []).filter((m: any) => m.role === 'user');
      const newBubbles = userMessages.flatMap((m: any) => this.buildUserMessagesFromContent(m.content));
      if (!newBubbles.length) return;

      this.chatMessages.update((msgs) => {
        const insertAt = msgs.findIndex((m) => m.streaming);
        if (insertAt === -1) return [...msgs, ...newBubbles];
        return [...msgs.slice(0, insertAt), ...newBubbles, ...msgs.slice(insertAt)];
      });
    }));

    this.streamService.resume(chatId);
  }

  private wireStreamSubscriptions(modelName: string, onChatListRefresh: () => void): void {
    this.sub?.unsubscribe();
    this.streamSubs.forEach((s) => s.unsubscribe());
    this.streamSubs = [];

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

          case 'api_report_mcp_progress': {
            const e = event as McpReportProgressEvent;
            this.chatMessages.update((msgs) => {
              const idx = this.lastIndexWhere(
                msgs,
                (m) => m.role === 'tool_call' && !!m.streaming,
              );
              if (idx === -1) return msgs;
              const copy = [...msgs];
              copy[idx] = {
                ...copy[idx],
                progress: Number(e.progress),
                total: e.total != null ? Number(e.total) : copy[idx].total,
                progressMessage: e.message ?? copy[idx].progressMessage,
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
      complete: () => {
        this.streaming.set(false);
        this.locked.set(false);
        this.generating.set(false);
      },
      error: () => {
        this.streaming.set(false);
        this.locked.set(false);
        this.generating.set(false);
      },
    });

    // Reasoning deltas — lazily create the bubble on first delta. Reasoning
    // always precedes the response it belongs to, so if an AI bubble is
    // already streaming (can happen when resuming mid-response), the new
    // reasoning bubble goes in front of it rather than at the array's end.
    this.streamSubs.push(this.streamService.reasoningDelta$.subscribe((chunk) => {
      this.chatMessages.update((msgs) => {
        const idx = this.lastIndexWhere(msgs, (m) => m.role === 'reasoning' && !!m.streaming);
        if (idx !== -1) {
          const copy = [...msgs];
          copy[idx] = { ...copy[idx], text: copy[idx].text + chunk };
          return copy;
        }
        const newBubble: ChatMessage = {
          role: 'reasoning',
          text: chunk,
          streaming: true,
          collapsed: false,
          date: new Date(),
        };
        const aiIdx = msgs.findIndex((m) => m.role === 'ai' && m.streaming);
        if (aiIdx === -1) return [...msgs, newBubble];
        return [...msgs.slice(0, aiIdx), newBubble, ...msgs.slice(aiIdx)];
      });
    }));

    // Text deltas — lazily create the ai bubble on first delta.
    this.streamSubs.push(this.streamService.messageDelta$.subscribe((chunk) => {
      this.chatMessages.update((msgs) => {
        const idx = this.lastIndexWhere(msgs, (m) => m.role === 'ai' && !!m.streaming);
        if (idx !== -1) {
          const copy = [...msgs];
          copy[idx] = { ...copy[idx], text: copy[idx].text + chunk };
          return copy;
        }
        return [
          ...msgs,
          { role: 'ai', text: chunk, streaming: true, date: new Date(), username: modelName },
        ];
      });
    }));

    this.streamSubs.push(this.streamService.chatEnd$.subscribe(() => {
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
    }));

    // Audio-transcribe mode: swap the just-submitted audio bubble for its
    // transcript once the backend parses it out of the model's response.
    this.streamSubs.push(this.streamService.audioTranscript$.subscribe((transcript) => {
      this.patchLast(
        (m) => m.role === 'user' && !!m.audio && !m.audioHidden,
        { text: transcript, audioHidden: true },
      );
    }));

    this.streamSubs.push(this.streamService.newChatCreated$.subscribe((result) => {
      if (this.currentChatId() !== result) {
        this.currentChatId.set(result);
        this.location.replaceState(`/chat-openai/${result}`);
      }
    }));
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
      if (file.type === 'input_audio' && file.audio_data) {
        return {
          type: 'input_audio',
          input_audio: { data: file.audio_data, format: file.audio_format ?? 'wav' },
          userRecorded: !!file.userRecorded,
        };
      }
      return { type: 'text', text: `[Attached file: ${file.filename}] (${file.assetUrl ?? ''})` };
    });
  }

  /** Reconstructs user-bubble ChatMessages from a Chat Completions `content`
   * value (string or content-part array) — used to render the echoed user
   * turn when resuming a generation that isn't in persisted history yet. */
  private buildUserMessagesFromContent(content: unknown): ChatMessage[] {
    const parts = Array.isArray(content) ? content : [{ type: 'text', text: content }];
    const out: ChatMessage[] = [];

    for (const part of parts as any[]) {
      if (part?.type === 'image_url' && part.image_url?.url) {
        out.push({ role: 'user', text: '', image: part.image_url.url, date: new Date(), username: 'You' });
      } else if (part?.type === 'input_audio' && part.input_audio?.data) {
        // Reaches here only when transcription is off (or the audio wasn't
        // userRecorded) — a transcribed part has already been replaced with
        // plain text server-side by the time this echo is sent.
        const format = part.input_audio.format ?? 'wav';
        out.push({
          role: 'user',
          text: '',
          audio: `data:audio/${format};base64,${part.input_audio.data}`,
          date: new Date(),
          username: 'You',
        });
      }
    }

    const textParts = (parts as any[]).filter((p) => p?.type === 'text' && p.text);
    const text = textParts.map((p) => p.text).join('\n');
    const transcribed = textParts.some((p) => p?.transcribed);
    if (text) out.push({ role: 'user', text, audioHidden: transcribed, date: new Date(), username: 'You' });

    return out;
  }

  resend(
    selectedModelId: string,
    reasoning: ReasoningEffort | undefined,
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
    this.streamSubs.forEach((s) => s.unsubscribe());
    this.streamSubs = [];
    this.streamService.reset();
    this.streaming.set(false);
    this.locked.set(false);
    this.generating.set(false);
    this.chatMessages.update((msgs) => msgs.filter((m) => !m.streaming));
  }

  destroy(): void {
    this.sub?.unsubscribe();
    this.streamSubs.forEach((s) => s.unsubscribe());
    this.stopLockPolling();
  }

  /**
   * Starts/stops polling this chat's lock status — only needed for shared
   * chats, where another user could start generating while we're looking at
   * it. If a poll finds the chat newly locked, we attach to the live
   * generation via `resumeStreaming` instead of just waiting for it to
   * finish. Non-shared chats have no other writer, so polling would be pure
   * overhead — callers should check `meta.locked` once at load time instead
   * and call `resumeStreaming` directly (see `loadChatMeta`).
   */
  updateLockPolling(chatId: string, shouldPoll: boolean, modelName: string, onChatListRefresh: () => void): void {
    this.stopLockPolling();
    if (!shouldPoll) {
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
          if (isLocked && !wasLocked && !this.streaming()) {
            this.resumeStreaming(chatId, modelName, onChatListRefresh);
          }
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
