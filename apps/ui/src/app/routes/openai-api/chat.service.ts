import { computed, inject, Injectable, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  OpenAiStreamService,
  OpenAiStreamErrorEvent,
  OpenAiStreamApiInfoEvent,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseReasoningTextDeltaEvent,
  McpItemTracking,
  CustomReportMcpProgressEvent,
} from './openai-stream.service';
import {
  ChatMetadataDto,
  ChatMetadataService,
  CreateChatMetadataDto,
  EasyInputMessageDto,
  McpCallDto,
  McpListToolsDto,
  MessageOutputDto,
  ReasoningDto,
  ReasoningOutputDto,
  ResponseInputTextDto,
  ResponseOutputItemAddedEventDto,
  ResponseOutputItemDoneEventDto,
  ResponseReasoningItemDto,
} from '../../client';
import { AppendedFile } from '../../shared/utils/file.utils';
import {
  ChatMessage,
  lastIndexWhere,
  patchLast,
  patchByItemId,
  finalizeStreamingMessages,
  safeParseJson,
} from '../../shared/utils/chat-message.utils';
import * as CryptoJS from 'crypto-js';
import InvokeAiModelToUseEnum = ChatMetadataDto.InvokeAiModelToUseEnum;

// Re-export ChatMessage so existing consumers importing from this file keep working.
export type { ChatMessage };

@Injectable()
export class ChatService {
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
  /** Always false — Shared Chats locking is only wired into the active Chat
   * Completions path; kept here purely for `activeChat`'s union type parity. */
  readonly locked = signal(false);

  private readonly lastUserInput = signal<string>('');
  private sub?: Subscription;

  // Tracks in-flight MCP tool call items (keyed by item id)
  private mcpTracking = new Map<string, McpItemTracking>();

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

  /** @deprecated Use shared lastIndexWhere util directly. Kept for backwards compatibility. */
  lastIndexWhere(msgs: ChatMessage[], pred: (m: ChatMessage) => boolean): number {
    return lastIndexWhere(msgs, pred);
  }

  patchLast(pred: (m: ChatMessage) => boolean, patch: Partial<ChatMessage>): void {
    this.chatMessages.update((msgs) => patchLast(msgs, pred, patch));
  }

  patchByItemId(itemId: string, patch: Partial<ChatMessage>): void {
    this.chatMessages.update((msgs) => patchByItemId(msgs, itemId, patch));
  }

  lastCreatedMcpCallItem: any;

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
    },
    afterPromptProcessing?: () => void,
  ): void {
    this.lastCreatedMcpCallItem = undefined;
    if (this.form.invalid || this.streaming()) return;
    let input = this.form.getRawValue().input!.trim();

    this.lastUserInput.set(input);
    this.form.reset();
    this.streaming.set(true);
    this.mcpTracking.clear();

    for (const f of appendedFiles ?? []) {
      this.chatMessages.update((msgs) => [
        ...msgs,
        f.image_url
          ? { role: 'user', image: f.image_url, date: new Date() } as ChatMessage
          : undefined
      ].filter(f => !!f));
    }

    this.chatMessages.update((msgs) => [...msgs, { role: 'user', text: (appendedFiles?.map(f => f.type === 'input_image' ? undefined : `::file[${f.filename}](${f.assetUrl}){size=${f.sizeKb} type=${f.filename.split('.')[1]}}`).filter(f => !!f).join('\n') ?? '') +  (appendedFiles?.length ? '  \n' : '') + input, date: new Date() }]);

    this.streamService.reset();
    this.sub?.unsubscribe();

    this.sub = this.streamService.events$.subscribe({
      next: (event) => {
        switch (event.type) {
          // ── A new output item starts ──────────────────────────────────────
          case ResponseOutputItemAddedEventDto.TypeEnum.ResponseOutputItemAdded: {
            const e = event as ResponseOutputItemAddedEvent;
            const item = e.item as any;

            if (item.type === ReasoningOutputDto.TypeEnum.Reasoning) {
              this.chatMessages.update((msgs) => [
                ...msgs,
                {
                  role: 'reasoning',
                  text: '',
                  streaming: true,
                  collapsed: false,
                  date: new Date(),
                  itemId: item.id,
                },
              ]);
            } else if (item.type === MessageOutputDto.TypeEnum.Message) {
              this.chatMessages.update((msgs) => [
                ...msgs,
                { role: 'ai', text: '', streaming: true, itemId: item.id },
              ]);
            } else if (item.type === McpListToolsDto.TypeEnum.McpListTools) {
              // Track but don't show in chat
            } else if (item.type === McpCallDto.TypeEnum.McpCall) {
              const serverLabel = item.server_label ?? item.name ?? undefined;
              this.mcpTracking.set(item.id, {
                itemId: item.id,
                serverLabel,
                toolName: item.name ?? undefined,
                outputIndex: e.output_index,
              });
              this.lastCreatedMcpCallItem = item;
              this.chatMessages.update((msgs) => [
                ...msgs,
                {
                  role: 'tool_call',
                  text: '',
                  streaming: true,
                  collapsed: false,
                  date: new Date(),
                  itemId: item.id,
                  toolName: item.name ?? '…',
                  providerLabel: serverLabel,
                },
              ]);
            }
            break;
          }

          // ── An output item is fully done ─────────────────────────────────
          case ResponseOutputItemDoneEventDto.TypeEnum.ResponseOutputItemDone: {
            const e = event as ResponseOutputItemDoneEventDto;
            const item = e.item;

            if (item.type === ResponseReasoningItemDto.TypeEnum.Reasoning && item.id) {
              this.patchByItemId(item.id, { streaming: false, collapsed: true });
            } else if (item.type === 'message') {
              this.patchByItemId(item.id, { streaming: false });
            } else if (item.type === McpCallDto.TypeEnum.McpCall) {
              const tracking = this.mcpTracking.get(item.id);
              if (item.status === 'completed' && 'output' in item) {
                let outputText: string = item.output ?? '';
                try {
                  const parsed = JSON.parse(outputText);
                  if (Array.isArray(parsed) && parsed[0]?.text != null) outputText = parsed[0].text;
                  else if (typeof parsed === 'object' && parsed !== null)
                    outputText = JSON.stringify(parsed, null, 2);
                } catch {
                  /* leave as-is */
                }
                this.patchByItemId(item.id, {
                  toolOutput: outputText || undefined,
                  toolName: tracking?.toolName ?? item.name ?? '…',
                  toolArguments: item.arguments ? safeParseJson(item.arguments) : undefined,
                  providerLabel: tracking?.serverLabel ?? item.server_label,
                  streaming: false,
                  progress: undefined,
                  progressMessage: undefined,
                  collapsed: true,
                });
              } else if (item.status === 'failed' || item.status === 'incomplete') {
                this.patchByItemId(item.id, {
                  toolOutput: item.error ?? 'Tool call failed',
                  toolFailed: true,
                  streaming: false,
                  collapsed: true,
                });
              }
              this.mcpTracking.delete(item.id);
            }
            break;
          }

          // ── MCP tool call in progress — extract tool name / args ──────────
          case 'response.mcp_call.in_progress': {
            const e = event as any;
            if (e.item) {
              const item = e.item;
              const tracking = this.mcpTracking.get(e.item_id ?? item.id);
              if (tracking) {
                tracking.toolName = item.name ?? tracking.toolName;
                tracking.serverLabel = item.server_label ?? tracking.serverLabel;
              }
              this.patchByItemId(e.item_id ?? item.id, {
                toolName: item.name ?? undefined,
                providerLabel: item.server_label ?? undefined,
              });
            }
            break;
          }

          case 'api_report_mcp_progress': {
            const e = event as CustomReportMcpProgressEvent;
            const tracking = this.mcpTracking.get(
              this.lastCreatedMcpCallItem.item_id ?? this.lastCreatedMcpCallItem.id,
            );
            if (tracking) {
              this.chatMessages.update((msgs) => [
                ...msgs.map((msg) => {
                  if (msg.itemId === tracking.itemId) {
                    return {
                      role: 'tool_call' as any,
                      text: '',
                      streaming: true,
                      collapsed: false,
                      date: new Date(),
                      progress: parseInt(e.progress),
                      total: parseInt(e.total),
                      progressMessage: e.message,
                      itemId: tracking.itemId,
                      toolName: tracking.toolName ?? '…',
                      providerLabel: tracking.serverLabel,
                    };
                  }
                  return msg;
                }),
              ]);

              this.patchByItemId(
                this.lastCreatedMcpCallItem.item_id ?? this.lastCreatedMcpCallItem.id,
                {
                  ...tracking,
                  progress: parseInt(e.progress),
                  total: parseInt(e.total),
                  progressMessage: e.message,
                },
              );
            }
            break;
          }

          // ── Reasoning text delta ──────────────────────────────────────────
          case 'response.reasoning_text.delta': {
            const e = event as ResponseReasoningTextDeltaEvent;
            this.chatMessages.update((msgs) => {
              const idx = lastIndexWhere(msgs, (m) => m.itemId === e.item_id);
              if (idx === -1) return msgs;
              const copy = [...msgs];
              copy[idx] = { ...copy[idx], text: copy[idx].text + e.delta };
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

          case 'response.failed': {
            const e = event as any;
            const msg = e.response?.error?.message ?? 'Response failed';
            this.chatMessages.update((msgs) => {
              const filtered = msgs[msgs.length - 1]?.streaming ? msgs.slice(0, -1) : msgs;
              return [...filtered, { role: 'error' as const, text: msg, date: new Date() }];
            });
            this.streaming.set(false);
            break;
          }
        }
      },
      complete: () => {
        this.streaming.set(false);
        afterPromptProcessing?.();
      },
      error: () => {
        this.streaming.set(false);
        afterPromptProcessing?.();
      },
    });

    // Text deltas arrive through the dedicated subject
    this.streamService.messageDelta$.subscribe((chunk) => {
      this.chatMessages.update((msgs) => {
        const copy = [...msgs];
        const idx = lastIndexWhere(copy, (m) => m.role === 'ai' && !!m.streaming);
        if (idx !== -1) copy[idx] = { ...copy[idx], text: copy[idx].text + chunk };
        return copy;
      });
    });

    this.streamService.chatEnd$.subscribe((result) => {
      const u = result.usage;
      const stats = u
        ? `${u.input_tokens} in · ${u.output_tokens} out${u.output_tokens_details?.reasoning_tokens ? ` · ${u.output_tokens_details.reasoning_tokens} reasoning` : ''}`
        : undefined;
      this.chatMessages.update((msgs) => finalizeStreamingMessages(msgs, stats));
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
        input: [
          ...((appendedFiles ?? [])
            .map((f) => {
              return f.id
                ? {
                    role: 'system',
                    content: [
                      {
                        type: 'input_text',
                        text: `Get file contents by passing "${f.id}" to the "get-content-from-file-ids" tool.`,
                      },
                    ],
                  }
                : undefined;
            })
            .filter((f) => !!f) as any),
          {
            role: 'user',
            content: [
              ...((appendedFiles?.filter(f => f.type === 'input_image')) ?? []),
              {
                type: 'input_text',
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
              },
            ],
          },
        ],
        reasoning: reasoning
          ? {
              effort: reasoning,
              summary: 'detailed',
              generate_summary: 'detailed',
            }
          : undefined,
        store: true,
      },
      this.currentChatId() ?? undefined,
      this.currentChatId() ? undefined : newChatOptions,
    );
  }

  resend(
    selectedModelId: string,
    reasoning: ReasoningDto.EffortEnum | undefined,
    appendedFiles: AppendedFile[] | undefined,
    encryptionKey: string | undefined,
    onChatListRefresh: () => void,
    afterPromptProcessing?: () => void,
  ): void {
    const input = this.lastUserInput();
    if (!input || this.streaming()) return;
    this.form.setValue({ input });
    this.submit(
      selectedModelId,
      reasoning,
      appendedFiles,
      encryptionKey,
      onChatListRefresh,
      undefined,
      afterPromptProcessing,
    );
  }

  reset(): void {
    this.sub?.unsubscribe();
    this.streamService.reset();
    this.streaming.set(false);
    this.chatMessages.update((msgs) => msgs.filter((m) => !m.streaming));
  }

  destroy(): void {
    this.sub?.unsubscribe();
  }
}
