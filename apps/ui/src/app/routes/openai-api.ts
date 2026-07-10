import { animate, style, transition, trigger } from '@angular/animations';
import { Component, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AuthService,
  ChatMetadataDto,
  ChatMetadataService,
  ChatRequestDto,
  ChatsService,
  CreateChatMetadataDto,
  ReasoningDto,
} from '../client';
import { ChatMessage, ChatCompletionsService } from './openai-api/chat-completions.service';
import { OpenAiModelSelectorComponent } from './openai-api/model-selector.component';

import { ChatSidebarComponent } from '../shared/components/chat-sidebar.component';
import { ChatMessagesComponent } from '../shared/components/chat-messages.component';
import { InfoComponent } from '../shared/components/info.component';
import { AppendedFile, OpenAiChatInputComponent } from './openai-api/chat-input.component';
import { Observable, of, tap } from 'rxjs';
import { ButtonComponent, IconButtonComponent, LabelComponent, TextInputComponent, ToggleComponent } from '../shared';
import { TranslateModule } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroBars3, heroPlus, heroSparkles, heroUser, heroXMark } from '@ng-icons/heroicons/outline';
import { BlobBackgroundDirective } from '../shared/directives/blob-background.directive';
import { map } from 'rxjs/operators';
import { OpenAiModelService } from './openai-model.service';
import InvokeAiModelToUseEnum = ChatMetadataDto.InvokeAiModelToUseEnum;
import EffortEnum = ReasoningDto.EffortEnum;

/** How the chat name is determined when creating a new chat. */
type ChatNameMode = 'ai' | 'custom' | 'none';

@Component({
  selector: 'app-openai-api',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ChatSidebarComponent,
    ChatMessagesComponent,
    OpenAiChatInputComponent,
    OpenAiModelSelectorComponent,
    InfoComponent,
    IconButtonComponent,
    ButtonComponent,
    LabelComponent,
    TextInputComponent,
    ToggleComponent,
    TranslateModule,
    NgIconComponent,
    BlobBackgroundDirective,
  ],
  viewProviders: [provideIcons({ heroBars3, heroUser, heroPlus, heroXMark, heroSparkles })],
  animations: [
    trigger('sidebarAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-100%)' }),
        animate(
          '240ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateX(0)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '180ms cubic-bezier(0.4, 0, 1, 1)',
          style({ opacity: 0, transform: 'translateX(-100%)' }),
        ),
      ]),
    ]),
    trigger('infoPanelAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(100%)' }),
        animate(
          '240ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateX(0)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '180ms cubic-bezier(0.4, 0, 1, 1)',
          style({ opacity: 0, transform: 'translateX(100%)' }),
        ),
      ]),
    ]),
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-6px)', height: 0, overflow: 'hidden' }),
        animate(
          '180ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateY(0)', height: '*' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '140ms cubic-bezier(0.4, 0, 1, 1)',
          style({ opacity: 0, transform: 'translateY(-4px)', height: 0, overflow: 'hidden' }),
        ),
      ]),
    ]),
  ],
  providers: [ChatCompletionsService, OpenAiModelService],
  template: `
    <div
      class="h-screen bg-surface-base text-text-primary flex flex-col overflow-hidden transition-colors duration-300"
    >
      <!-- ── Top bar ── -->
      <div
        class="flex items-center gap-2 border-b border-border-default px-3 py-2 shrink-0 bg-surface-raised"
        style="box-shadow: 0 1px 0 var(--color-border-subtle), var(--shadow-sm);"
      >
        <div
          class="w-7 h-7 rounded-2xl flex items-center justify-center"
          style="box-shadow: 0 8px 32px var(--color-accent-glow);"
        >
          <img src="logo-cropped.png" class="w-full h-full text-white" alt="logo" />
        </div>
        <ui-button
          variant="secondary"
          size="xs"
          [active]="showChatsSidebar()"
          (clicked)="showChatsSidebar.set(!showChatsSidebar())"
          [title]="'toolbar.toggleChats' | translate"
        >
          <ng-icon name="heroBars3" class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ 'toolbar.chats' | translate }}</span>
        </ui-button>

        <div
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-overlay border border-border-subtle ml-1"
        >
          <div
            class="w-1.5 h-1.5 rounded-full bg-success-muted animate-pulse shrink-0"
            style="box-shadow: 0 0 6px var(--color-success-muted);"
          ></div>
          <span
            class="text-[10px] text-text-muted tracking-wider font-medium uppercase hidden md:block"
            >{{ 'login.appName' | translate }} · OpenAI</span
          >
        </div>

        <!-- Provider tabs -->

        <div class="relative ml-auto">
          <app-openai-model-selector
            [models]="modelService.models()"
            [modelsLoading]="modelService.modelsLoading()"
            [selectedModel]="modelService.selectedModel()"
            [hasChatOpen]="activeChat.hasChatOpen()"
            (modelSelected)="modelService.selectModel($event)"
          />
        </div>

        <!-- User / Info panel toggle -->
        <ui-icon-button
          [active]="showInfoPanel()"
          [title]="'toolbar.userInfo' | translate"
          (clicked)="showInfoPanel.set(!showInfoPanel())"
        >
          <ng-icon name="heroUser" class="w-3.5 h-3.5" />
        </ui-icon-button>
      </div>

      <!-- ── Body ── -->
      <div appBlobBackground class="flex flex-1 overflow-hidden relative min-h-0 bg-surface-base">
        @if (showChatsSidebar()) {
          <app-chat-sidebar
            #chatSidebar
            client="OPENAI"
            (newChat)="newChat()"
            [chatList]="chatList()"
            [chatsLoading]="chatsLoading()"
            [currentChatId]="activeChat.currentChatId()"
            (chatOpened)="openChat($event)"
            (commitRename)="onRename($event)"
            (chatDeleted)="deleteChat($event)"
            (openChatSettings)="onOpenChatSettings($event)"
            (saveCryptoSettings)="onSaveCryptoSettings($event)"
            (shareChat)="onShareChat($event)"
            (unshareChat)="onUnshareChat($event)"
            @sidebarAnim
            (@sidebarAnim.done)="clearAnimTransform($event)"
          />
        }

        <!-- CENTER: Chat window -->
        <div class="flex flex-col flex-1 min-w-0 overflow-hidden relative">
          <div class="flex flex-col flex-1 min-h-0 overflow-hidden max-w-3xl w-full mx-auto">
            <div #messageContainer class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              <app-chat-messages
                client="OPENAI"
                [isLoadingMessages]="this.isLoadingMessages()"
                [messages]="$any(activeChat.chatMessages())"
                [streaming]="activeChat.streaming()"
                [showResend]="activeChat.showResend()"
                (toggleCollapsed)="activeChat.toggleCollapsed($event)"
                (resend)="resend()"
              >
                @if (!activeChat.hasChatOpen()) {
                  <div
                    class="flex flex-col gap-4 w-full max-w-xl mx-auto mt-6 p-5 bg-surface-raised border border-border-default rounded-xl shadow-lg shadow-black/20"
                  >
                    <!-- Header -->
                    <div class="flex items-center gap-2 border-b border-border-default pb-3">
                      <ng-icon name="heroPlus" class="w-4 h-4 text-accent shrink-0" />
                      <span class="text-sm font-semibold text-text-primary tracking-wide">{{
                        'toolbar.newChatOptions' | translate
                      }}</span>
                    </div>

                    <!-- Chat Name -->
                    <div>
                      <ui-label class="mb-2">{{
                        'chatSettings.chatNameLabel' | translate
                      }}</ui-label>

                      <!-- 3-way segmented control -->
                      <div
                        class="flex rounded-lg border border-border-default overflow-hidden bg-surface-base"
                      >
                        <!-- AI Decides -->
                        <button
                          type="button"
                          class="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          [class.bg-accent]="newChatNameMode() === 'ai'"
                          [class.text-white]="newChatNameMode() === 'ai'"
                          [class.text-text-muted]="newChatNameMode() !== 'ai'"
                          [class.hover:bg-surface-overlay]="newChatNameMode() !== 'ai'"
                          (click)="newChatNameMode.set('ai')"
                        >
                          <ng-icon name="heroSparkles" class="w-3 h-3 shrink-0" />
                          <span>{{ 'chatSettings.chatNameAi' | translate }}</span>
                        </button>

                        <div class="w-px bg-border-default self-stretch"></div>

                        <!-- Custom -->
                        <button
                          type="button"
                          class="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          [class.bg-accent]="newChatNameMode() === 'custom'"
                          [class.text-white]="newChatNameMode() === 'custom'"
                          [class.text-text-muted]="newChatNameMode() !== 'custom'"
                          [class.hover:bg-surface-overlay]="newChatNameMode() !== 'custom'"
                          (click)="newChatNameMode.set('custom')"
                        >
                          <span>{{ 'chatSettings.chatNameCustom' | translate }}</span>
                        </button>

                        <div class="w-px bg-border-default self-stretch"></div>

                        <!-- None -->
                        <button
                          type="button"
                          class="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          [class.bg-accent]="newChatNameMode() === 'none'"
                          [class.text-white]="newChatNameMode() === 'none'"
                          [class.text-text-muted]="newChatNameMode() !== 'none'"
                          [class.hover:bg-surface-overlay]="newChatNameMode() !== 'none'"
                          (click)="newChatNameMode.set('none')"
                        >
                          <span>{{ 'chatSettings.chatNameNone' | translate }}</span>
                        </button>
                      </div>

                      <!-- Mode hint -->
                      <p class="mt-1.5 text-[10px] text-text-muted leading-relaxed">
                        @if (newChatNameMode() === 'ai') {
                          {{ 'chatSettings.chatNameAiHint' | translate }}
                        } @else if (newChatNameMode() === 'custom') {
                          {{ 'chatSettings.chatNameCustomHint' | translate }}
                        } @else {
                          {{ 'chatSettings.chatNameNoneHint' | translate }}
                        }
                      </p>

                      <!-- Custom name input — only visible in 'custom' mode -->
                      @if (newChatNameMode() === 'custom') {
                        <div @slideDown class="mt-2">
                          <ui-text-input
                            [(ngModel)]="newChatName"
                            [placeholder]="'toolbar.optionalName' | translate"
                            [autofocus]="true"
                          />
                        </div>
                      }
                    </div>

                    <!-- Model selector -->
                    <div class="flex items-center justify-between">
                      <div class="flex flex-col items-start">
                        <ui-label>{{ 'chatSettings.model' | translate }}</ui-label>
                        <span class="text-[10px] text-text-muted mt-0.5 block">{{
                          'chatSettings.modelHint' | translate
                        }}</span>
                      </div>
                      <div class="relative ml-auto">
                        <app-openai-model-selector
                          [models]="modelService.models()"
                          [modelsLoading]="modelService.modelsLoading()"
                          [selectedModel]="modelService.selectedModel()"
                          [hasChatOpen]="activeChat.hasChatOpen()"
                          (modelSelected)="modelService.selectModel($event)"
                        />
                      </div>
                    </div>
                    <!-- Encryption toggle -->
                    <div class="flex items-center justify-between">
                      <div class="flex flex-col items-start">
                        <ui-label>{{ 'chatSettings.encryption' | translate }}</ui-label>
                        <span class="text-[10px] text-text-muted mt-0.5 block">{{
                          'chatSettings.encryptionHint' | translate
                        }}</span>
                      </div>
                      <ui-toggle
                        [(ngModel)]="newChatUseCryptoModel"
                        activeColor="bg-amber-500"
                        (checkedChange)="newChatUseCrypto.set($event)"
                      />
                    </div>

                    <!-- Crypto key input -->
                    @if (newChatUseCrypto()) {
                      <div class="flex flex-col items-start">
                        <ui-label class="mb-1.5 ">{{
                          'chatSettings.encryptionKey' | translate
                        }}</ui-label>
                        <ui-text-input
                          class="w-full"
                          type="password"
                          [showToggle]="true"
                          [mono]="true"
                          [(ngModel)]="newChatCryptoKey"
                          [placeholder]="'chatSettings.encryptionKeyPlaceholder' | translate"
                        />
                      </div>
                    }
                    <!-- Invoke AI toggle -->
                    <div class="flex items-center justify-between">
                      <div class="flex flex-col items-start">
                        <ui-label>{{ 'chatSettings.invoke' | translate }}</ui-label>
                        <span class="text-[10px] text-text-muted mt-0.5 block">{{
                          'chatSettings.invokeHint' | translate
                        }}</span>
                      </div>
                      <ui-toggle
                        [(ngModel)]="newChatUseInvokeFeature"
                        activeColor="bg-amber-500"
                        (checkedChange)="newChatUseInvoke.set($event)"
                      />
                    </div>
                    @if (newChatUseInvoke()) {
                      <div class="flex flex-col items-start">
                        <ui-label class="mb-1.5 {{ !newChatUseInvoke() ? 'opacity-0.5' : '' }}">{{
                          'toolbar.invokeModel' | translate
                        }}</ui-label>
                        <span class="text-[10px] text-text-muted mt-0.5 block">{{
                          'toolbar.invokeModelHint' | translate
                        }}</span>
                        <div class="flex w-full gap-2 mt-5">
                          <ui-button
                            [disabled]="!newChatUseInvoke()"
                            class="flex-1"
                            size="md"
                            variant="secondary"
                            [active]="invokeAiModelPreference() === 'Juggernaut XL v9'"
                            (clicked)="invokeAiModelPreference.set('Juggernaut XL v9')"
                            ><p class="p-1.5">Juggernaut XL v9</p>
                            <div class="absolute top-0 right-2 text-[10px] text-warn">
                              sdxl
                            </div></ui-button
                          >
                          <ui-button
                            class="flex-1"
                            size="md"
                            variant="secondary"
                            [disabled]="!newChatUseInvoke()"
                            [active]="invokeAiModelPreference() === 'Dreamshaper 8'"
                            (clicked)="invokeAiModelPreference.set('Dreamshaper 8')"
                            ><p class="p-1.5">Dreamshaper 8</p>
                            <div class="absolute top-0 right-2 text-[10px] text-warn">
                              sd 1.5
                            </div></ui-button
                          >
                        </div>
                      </div>
                    }
                  </div>
                }
              </app-chat-messages>
            </div>

            <app-openai-chat-input
              #chatInput
              [form]="activeChat.form"
              [streaming]="activeChat.streaming()"
              [locked]="activeChat.locked()"
              [reasoning]="$any(modelService.reasoning())"
              [modelReasoningCap]="modelService.modelReasoningCap()"
              (submitted)="submit()"
              [newChatIdProvider]="newChatIdProvider"
              (reset)="activeChat.reset()"
              (reasoningChanged)="selectReasoning($event)"
              (appendedFilesChanged)="appendedFiles.set($event)"
            />
          </div>
        </div>

        @if (showInfoPanel()) {
          <div
            class="w-72 shrink-0 border-l border-border-default md:z-0 z-10 bg-surface-raised md:relative fixed md:h-auto h-full top-0 right-0 flex flex-col overflow-hidden"
            @infoPanelAnim
          >
            <div
              class="flex items-center justify-between px-3 py-2 border-b border-border-default shrink-0"
            >
              <span class="text-xs font-semibold text-text-primary">{{
                'info.info' | translate
              }}</span>
              <ui-icon-button
                size="sm"
                [title]="'common.close' | translate"
                (clicked)="showInfoPanel.set(false)"
              >
                <ng-icon name="heroXMark" class="w-3.5 h-3.5" />
              </ui-icon-button>
            </div>
            <div class="flex-1 overflow-hidden">
              <app-info />
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class OpenAiApi implements OnDestroy, OnInit {
  readonly chatCompletionsService = inject(ChatCompletionsService);
  readonly modelService = inject(OpenAiModelService);
  /** The Chat Completions service is the only supported chat backend. */
  get activeChat(): ChatCompletionsService {
    return this.chatCompletionsService;
  }
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatsApi = inject(ChatsService);
  private readonly chatMetaService = inject(ChatMetadataService);
  private readonly authService = inject(AuthService);
  readonly location = inject(Location);

  /** Username of the signed-in user, used to label their own messages as "You" in shared chats. */
  private currentUsername?: string;

  @ViewChild('messageContainer') private messageContainer?: ElementRef<HTMLElement>;
  @ViewChild('chatInput') private chatInputRef?: OpenAiChatInputComponent;
  @ViewChild('chatSidebar') private chatSidebarRef?: ChatSidebarComponent;

  readonly infoRef = viewChild(InfoComponent);
  readonly showChatsSidebar = signal(true);
  readonly showInfoPanel = signal(false);
  readonly chatList = signal<any[]>([]);
  readonly chatsLoading = signal(false);
  readonly appendedFiles = signal<AppendedFile[]>([]);
  readonly isLoadingMessages = signal(false);

  // ── New-chat options ───────────────────────────────────────────────────────
  readonly newChatEndpointPreference =
    signal<CreateChatMetadataDto.OpenAiEndpointPreferenceEnum>('COMPLETION');
  readonly newChatUseCrypto = signal(false);
  readonly newChatUseInvoke = signal(true);
  readonly invokeAiModelPreference = signal<InvokeAiModelToUseEnum>('Dreamshaper 8');
  newChatCryptoKey = '';
  newChatName = '';
  /** Two-way ngModel bridge for ui-toggle — kept in sync with newChatUseCrypto signal. */
  newChatUseCryptoModel = false;
  newChatUseInvokeFeature = true;

  /**
   * Controls how the new chat's name is determined.
   *  'ai'     – backend / AI generates a name from the first message
   *  'custom' – user types a name in the text input below the selector
   *  'none'   – chat is created without a name
   */
  readonly newChatNameMode = signal<ChatNameMode>('ai');

  private chatId?: string;
  /** Whether the currently open chat is shared with other users. */
  private isSharedChat = false;
  /** Model used by the currently open chat, shown above AI messages. */
  private usedModel?: string;

  constructor() {
    effect(() => {
      this.activeChat.chatMessages();
      this.scrollToBottom(this.messageContainer);
    });

    effect(() => {
      const cap = this.modelService.modelReasoningCap();
      if (!cap && this.modelService.reasoning()) this.modelService.setReasoning(undefined);
      if (!this.activeChat.hasChatOpen())
        this.modelService.setReasoning(
          (cap?.allowed_options?.find((e) => e.startsWith(cap?.default)) as any) ?? undefined,
        );
    });
  }

  readonly newChatIdProvider = (): Observable<string> => {
    if (this.activeChat.currentChatId()) {
      return of(this.activeChat.currentChatId()!);
    }

    return this.chatMetaService
      .createChatMetadata({
        name: this.resolvedChatName() ?? 'New Chat',
        client: CreateChatMetadataDto.ClientEnum.Openai,
        usedModel: this.modelService.selectedModel()!.id as string,
        useCrypto: this.newChatUseCrypto() ?? false,
        cryptoKey: this.newChatCryptoKey || undefined,
        openAiEndpointPreference: this.newChatEndpointPreference(),
        invokeAiModelToUse: this.invokeAiModelPreference(),
        useInvoke: this.newChatUseInvoke(),
        reasoningMode: this.modelService.reasoning()! as string,
      })
      .pipe(
        map((res) => res._id),
        tap((chatId) => {
          this.activeChat.currentChatId.set(chatId);
          this.chatId = chatId ?? undefined;
          if (chatId) {
            this.loadChatMeta(chatId);
            this.location.replaceState(`/chat-openai/${chatId}`);
            this.loadChatList();
          }
        }),
      );
  };

  triggerUserReload(): void {
    this.infoRef()?.loadUser();
  }

  ngOnInit(): void {
    this.loadChatList();
    this.modelService.loadModels();
    this.authService.getMe().subscribe({
      next: (me) => (this.currentUsername = me.username),
    });

    const chatId = this.route.snapshot.paramMap.get('chatId');
    this.chatId = chatId ?? undefined;
    if (chatId) {
      this.loadChatMeta(chatId);
    } else {
      this.activeChat.currentChatId.set(null);
    }
  }

  ngOnDestroy(): void {
    this.chatCompletionsService.destroy();
  }

  // ── Model management ──────────────────────────────────────────────────────

  private loadChatMeta(chatId: string): void {
    this.chatMetaService.getChatMetadata(chatId).subscribe({
      next: (meta) => {
        this.activeChat.currentChatId.set(chatId);
        this.isSharedChat = (meta.sharedWith?.length ?? 0) > 0;
        this.usedModel = meta.usedModel;
        this.loadCompletionsChatHistory(chatId);
        this.chatCompletionsService.updateLockPolling(
          chatId,
          (meta.sharedWith?.length ?? 0) > 0,
          () => this.loadCompletionsChatHistory(chatId),
        );

        const reasoningValue = meta.reasoningMode as ReasoningDto.EffortEnum | undefined;
        const match = this.modelService.models()?.find((m) => m.id === meta.usedModel);
        if (match) this.modelService.selectModel(match);
        if (reasoningValue) {
          this.modelService.setEffort(reasoningValue);
        }
      },
    });
  }

  // ── Chat list ─────────────────────────────────────────────────────────────

  loadChatList(): void {
    this.chatsLoading.set(true);
    this.chatMetaService.listChatMetadata().subscribe({
      next: (list) => {
        const sorted = [...list].sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        this.chatList.set(sorted);
        this.chatsLoading.set(false);
      },
      error: () => this.chatsLoading.set(false),
    });
  }

  /** Extracts plain text from a Chat Completions message's `content`, which may be
   * a plain string (assistant/tool turns) or an array of content parts (user turns). */
  private extractCompletionsMessageText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part === 'string' ? part : (part?.text ?? '')))
        .filter(Boolean)
        .join('\n');
    }
    return '';
  }

  /** History loader for Chat Completions sessions — reads the rolling `messages[]` array,
   * reconstructing tool-call banners from assistant `tool_calls` + matching `tool` replies. */
  private loadCompletionsChatHistory(chatId: string): void {
    this.isLoadingMessages.set(true);
    this.chatsApi.getChatEntries(chatId).subscribe((res) => {
      const latest = res[res.length - 1] as any;
      const rawMessages: any[] = latest?.messages ?? [];
      const date = new Date(latest?.createdAt ?? Date.now());

      // Entries are oldest-first snapshots of the rolling `messages` array, each stamped
      // with the username of whoever submitted that turn. Map each raw message index to
      // the username of the entry that first introduced it, so senders can be labeled
      // in shared chats.
      const entries = res as any[];
      const senderByIndex = entries.flatMap((entry, i) => {
        const prevLen = (entries[i - 1]?.messages as any[] | undefined)?.length ?? 0;
        const entryLen = (entry?.messages as any[] | undefined)?.length ?? 0;
        return Array<string | undefined>(Math.max(entryLen - prevLen, 0)).fill(entry?.username);
      });

      // Index tool results by tool_call_id so they can be attached to their originating call.
      const toolResultsById = new Map<string, string>();
      for (const m of rawMessages) {
        if (m.role === 'tool' && m.tool_call_id) {
          toolResultsById.set(m.tool_call_id, this.extractCompletionsMessageText(m.content));
        }
      }

      const messages: ChatMessage[] = [];
      rawMessages.forEach((m, index) => {
        const username =
          senderByIndex[index] === this.currentUsername || !this.isSharedChat
            ? 'You'
            : (senderByIndex[index] ?? 'You');
        if (m.role === 'user') {
          if (Array.isArray(m.content)) {
            for (const part of m.content) {
              if (part?.type === 'image_url' && part.image_url?.url) {
                messages.push({ role: 'user', text: '', image: part.image_url.url, date, username });
              }
            }
          }
          const text = this.extractCompletionsMessageText(m.content);
          if (text) messages.push({ role: 'user', text, date, username });
        } else if (m.role === 'assistant') {
          if (m.reasoning_content) {
            messages.push({
              role: 'reasoning',
              text: m.reasoning_content,
              collapsed: true,
              date,
            });
          }
          if (Array.isArray(m.tool_calls)) {
            for (const tc of m.tool_calls) {
              messages.push({
                role: 'tool_call',
                text: '',
                toolName: tc.function?.name,
                toolArguments: this.safeParseJson(tc.function?.arguments),
                toolOutput: toolResultsById.get(tc.id),
                collapsed: true,
                date,
              });
            }
          }
          const text = this.extractCompletionsMessageText(m.content);
          if (text) messages.push({ role: 'ai', text, date, username: this.usedModel });
        }
      });

      this.isLoadingMessages.set(false);
      this.chatCompletionsService.chatMessages.set(messages as any);
    });
  }

  private safeParseJson(value: unknown): object | undefined {
    if (typeof value === 'object' && value !== null) return value as object;
    if (typeof value !== 'string') return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Resolves the effective chat name based on the currently selected naming mode.
   *  'ai'     → undefined  (backend interprets absence as "please auto-name")
   *  'custom' → trimmed user input (or undefined if left blank)
   *  'none'   → '' empty string
   */
  private resolvedChatName(): string | undefined {
    switch (this.newChatNameMode()) {
      case 'ai':
        return undefined;
      case 'custom':
        return this.newChatName.trim() || undefined;
      case 'none':
        return '';
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  openChat(chatId: string): void {
    if (this.activeChat.streaming()) return;
    this.chatCompletionsService.chatMessages.set([]);
    this.router.navigate(['/chat-openai', chatId]);
    this.chatId = chatId;
    this.loadChatMeta(chatId);
  }

  newChat(): void {
    if (this.activeChat.streaming()) return;
    this.chatCompletionsService.chatMessages.set([]);
    this.chatCompletionsService.currentChatId.set(null);
    this.chatCompletionsService.stopLockPolling();
    this.router.navigate(['/chat-openai']);
    // Reset new-chat options to defaults
    this.newChatUseCrypto.set(false);
    this.newChatUseCryptoModel = false;
    this.newChatCryptoKey = '';
    this.newChatName = '';
    this.newChatNameMode.set('ai');
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  submit(): void {
    if (this.chatId) {
      this.chatCompletionsService.submit(
        this.modelService.selectedModel()?.id ?? '',
        this.modelService.reasoning() as EffortEnum,
        this.appendedFiles(),
        undefined,
        () => this.loadChatList(),
        undefined,
      );
      this.chatInputRef?.clearFiles();
      return;
    }

    this.chatCompletionsService.submit(
      this.modelService.selectedModel()?.id ?? '',
      this.modelService.reasoning() as EffortEnum,
      this.appendedFiles(),
      undefined,
      () => this.loadChatList(),
      {
        name: this.resolvedChatName(),
        letAiDecideChatName: this.newChatNameMode() === 'ai',
        useCrypto: this.newChatUseCrypto(),
        cryptoKey: this.newChatCryptoKey || undefined,
        openAiEndpointPreference: 'COMPLETION',
        invokeAiModelToUse: this.invokeAiModelPreference(),
        useInvoke: this.newChatUseInvoke(),
      },
    );
    this.chatInputRef?.clearFiles();
  }

  resend(): void {
    this.submit();
  }

  selectReasoning(value: ChatRequestDto.ReasoningEnum | ReasoningDto.EffortEnum): void {
    this.modelService.setEffort(value as ReasoningDto.EffortEnum);
    const chatId = this.activeChat.currentChatId();
    if (chatId) {
      this.chatMetaService.updateChatMetadata(chatId, { reasoningMode: value }).subscribe();
    }
  }

  // ── Chat rename / delete ──────────────────────────────────────────────────

  onRename({ chatId, name }: { chatId: string; name: string }): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.chatMetaService.updateChatMetadata(chatId, { name: trimmed }).subscribe({
      next: () => {
        this.chatList.update((list) =>
          list.map((c) => (c._id === chatId ? { ...c, name: trimmed } : c)),
        );
      },
    });
  }

  deleteChat(chatId: string): void {
    this.chatMetaService.deleteChatMetadata(chatId).subscribe({
      next: () => {
        this.chatList.update((list) => list.filter((c) => c._id !== chatId));
        if (this.activeChat.currentChatId() === chatId) this.newChat();
      },
    });
  }

  onOpenChatSettings(chatId: string): void {
    this.chatMetaService.getChatMetadata(chatId).subscribe({
      next: (chat) => {
        this.chatSidebarRef?.loadSettingsData(
          chat.name ?? '',
          chat.useCrypto ?? false,
          chat.cryptoKey ?? '',
          chat.useInvoke ?? false,
          chat.invokeAiModelToUse ?? undefined,
        );
      },
      error: () => {
        this.chatSidebarRef?.loadSettingsData('', false, '', false, undefined);
      },
    });
  }

  onSaveCryptoSettings({
    chatId,
    name,
    useCrypto,
    cryptoKey,
    useInvoke,
    invokeAiModelToUse,
  }: {
    chatId: string;
    name: string;
    useCrypto: boolean;
    cryptoKey: string;
    useInvoke: boolean;
    invokeAiModelToUse?: InvokeAiModelToUseEnum;
  }): void {
    this.chatMetaService
      .updateChatMetadata(chatId, { name, useCrypto, cryptoKey, invokeAiModelToUse, useInvoke })
      .subscribe({
        next: () => {
          this.chatList.update((list) =>
            list.map((c) => (c._id === chatId ? { ...c, name, useCrypto } : c)),
          );
        },
      });
  }

  onShareChat({ chatId, username }: { chatId: string; username: string }): void {
    this.chatMetaService.shareChatMetadata(chatId, username).subscribe({
      next: (updated) => {
        this.chatList.update((list) =>
          list.map((c) => (c._id === chatId ? { ...c, ...updated } : c)),
        );
        this.chatSidebarRef?.updateShareResult(
          updated.sharedWith ?? [],
          updated.sharedWithUsernames ?? [],
        );
      },
      error: (err) => {
        this.chatSidebarRef?.setShareError(
          err?.error?.message ?? `User "${username}" not found`,
        );
      },
    });
  }

  onUnshareChat({ chatId, userId }: { chatId: string; userId: string }): void {
    this.chatMetaService.unshareChatMetadata(chatId, userId).subscribe({
      next: (updated) => {
        this.chatList.update((list) =>
          list.map((c) => (c._id === chatId ? { ...c, ...updated } : c)),
        );
        this.chatSidebarRef?.updateShareResult(
          updated.sharedWith ?? [],
          updated.sharedWithUsernames ?? [],
        );
      },
      error: (err) => {
        this.chatSidebarRef?.setShareError(err?.error?.message ?? 'Failed to revoke access');
      },
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private scrollToBottom(ref?: ElementRef<HTMLElement>): void {
    if (!ref?.nativeElement) return;
    const el = ref.nativeElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= 50) {
      setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 0);
    }
  }

  /**
   * The sidebar's :enter animation leaves `transform: translateX(0)` as a
   * permanent inline style, which — despite being visually a no-op — creates a
   * new CSS containing block/stacking context on the sidebar. That traps any
   * `position: fixed` overlays rendered inside it (e.g. the file preview
   * modal) beneath sibling elements instead of the true viewport. Clearing it
   * once the enter transition finishes is safe since translateX(0) === identity.
   */
  clearAnimTransform(event: { toState: string; element: HTMLElement }): void {
    if (event.toState !== 'void') {
      event.element.style.transform = '';
    }
  }
}
