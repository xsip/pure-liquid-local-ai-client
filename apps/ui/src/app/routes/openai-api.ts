import { animate, style, transition, trigger } from '@angular/animations';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ChatMetadataDto,
  ChatMetadataService,
  ChatRequestDto,
  ChatsService,
  ContentDto,
  CreateChatMetadataDto,
  EasyInputMessageDtoContentInner,
  MessageDtoContentInner,
  ModelOpenAiDto,
  OpenAIService,
  ReasoningDto,
  ResponseInputFileDto,
  ResponseInputImageDto,
  ResponseInputTextDto,
  ResponseOutputMessageDtoContentInner,
  ResponseOutputRefusalDto,
  ResponseOutputTextDto,
} from '../client';
import { ChatMessage, ChatService } from './openai-api/chat.service';
import { OpenAiModelSelectorComponent } from './openai-api/model-selector.component';

// Re-use the shared sub-components from lm-studio-api — they are generic enough
import { ChatSidebarComponent } from './lm-studio-api/chat-sidebar.component';
import { ChatMessagesComponent } from './lm-studio-api/chat-messages.component';
import { InfoComponent } from './lm-studio-api/info.component';
import { ModelReasoningCapability } from './lm-studio-api/model-selector.component';
import { AppendedFile, OpenAiChatInputComponent } from './openai-api/chat-input.component';
import { take } from 'rxjs';
import { IconButtonComponent } from '../shared/components/ui/icon-button.component';
import { ButtonComponent } from '../shared/components/ui/button.component';
import { LabelComponent } from '../shared/components/ui/label.component';
import { TextInputComponent } from '../shared/components/ui/text-input.component';
import { ToggleComponent } from '../shared/components/ui/toggle.component';
import { TranslateModule } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroBars3,
  heroUser,
  heroPlus,
  heroXMark,
  heroSparkles,
} from '@ng-icons/heroicons/outline';
import InvokeAiModelToUseEnum = ChatMetadataDto.InvokeAiModelToUseEnum;
import { BlobBackgroundDirective } from '../shared/directives/blob-background.directive';

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
  providers: [ChatService],
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
            [models]="models()"
            [modelsLoading]="modelsLoading()"
            [selectedModel]="selectedModel()"
            [hasChatOpen]="chatService.hasChatOpen()"
            (modelSelected)="selectModel($event)"
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
            [currentChatId]="chatService.currentChatId()"
            (chatOpened)="openChat($event)"
            (commitRename)="onRename($event)"
            (chatDeleted)="deleteChat($event)"
            (openChatSettings)="onOpenChatSettings($event)"
            (saveCryptoSettings)="onSaveCryptoSettings($event)"
            @sidebarAnim
          />
        }

        <!-- CENTER: Chat window -->
        <div class="flex flex-col flex-1 min-w-0 overflow-hidden relative">
          <div class="flex flex-col flex-1 min-h-0 overflow-hidden max-w-3xl w-full mx-auto">
            <div #messageContainer class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              <app-chat-messages
                client="OPENAI"
                [isLoadingMessages]="this.isLoadingMessages()"
                [messages]="$any(chatService.chatMessages())"
                [streaming]="chatService.streaming()"
                [showResend]="chatService.showResend()"
                (toggleCollapsed)="chatService.toggleCollapsed($event)"
                (resend)="resend()"
              >
                @if (!chatService.hasChatOpen()) {
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

                    <!-- Endpoint Preference -->
                    <div>
                      <ui-label class="mb-1.5">{{ 'toolbar.endpoint' | translate }}</ui-label>
                      <div class="flex gap-2">
                        <ui-button
                          class="flex-1"
                          variant="secondary"
                          [active]="newChatEndpointPreference() === 'RESPONSES'"
                          (clicked)="newChatEndpointPreference.set('RESPONSES')"
                          >{{ 'toolbar.responsesApi' | translate }}</ui-button
                        >
                        <ui-button
                          class="flex-1"
                          variant="secondary"
                          [disabled]="true"
                          [active]="newChatEndpointPreference() === 'COMPLETION'"
                          (clicked)="newChatEndpointPreference.set('COMPLETION')"
                          >{{ 'toolbar.chatCompletions' | translate }}</ui-button
                        >
                      </div>
                      <p class="mt-1.5 text-[10px] text-text-muted">
                        @if (newChatEndpointPreference() === 'RESPONSES') {
                          {{ 'toolbar.endpointResponsesDesc' | translate }}
                        } @else {
                          {{ 'toolbar.endpointCompletionsDesc' | translate }}
                        }
                      </p>
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
                          [models]="models()"
                          [modelsLoading]="modelsLoading()"
                          [selectedModel]="selectedModel()"
                          [hasChatOpen]="chatService.hasChatOpen()"
                          (modelSelected)="selectModel($event)"
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
              [form]="chatService.form"
              [streaming]="chatService.streaming()"
              [reasoning]="reasoning()"
              [modelReasoningCap]="modelReasoningCap()"
              (submitted)="submit()"
              (reset)="chatService.reset()"
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
              <app-info [uiType]="'OPENAI'" />
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class OpenAiApi implements OnDestroy, OnInit {
  readonly chatService = inject(ChatService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatsApi = inject(ChatsService);
  private readonly chatMetaService = inject(ChatMetadataService);
  private readonly openAiService = inject(OpenAIService);
  readonly reasoning = signal<ReasoningDto.EffortEnum | undefined>(undefined);
  readonly modelReasoningCap = computed<ModelReasoningCapability | null>(() => {
    return {
      allowed_options: Object.values(ReasoningDto.EffortEnum).map((v) => v),
      default: Object.values(ReasoningDto.EffortEnum)[0][0],
    };
  });
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
    signal<CreateChatMetadataDto.OpenAiEndpointPreferenceEnum>('RESPONSES');
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

  readonly models = signal<ModelOpenAiDto[]>([]);
  readonly modelsLoading = signal(false);
  readonly selectedModel = signal<ModelOpenAiDto | null>(this.loadStoredModel());

  private static readonly MODEL_STORAGE_KEY = 'openai-model';

  constructor() {
    effect(() => {
      this.chatService.chatMessages();
      this.scrollToBottom(this.messageContainer);
    });

    effect(() => {
      const cap = this.modelReasoningCap();
      if (!cap && this.reasoning()) this.reasoning.set(undefined);
      if (!this.chatService.hasChatOpen())
        this.reasoning.set(
          (cap?.allowed_options?.find((e) => e.startsWith(cap?.default)) as any) ?? undefined,
        );
    });
  }

  triggerUserReload() {
    this.infoRef()?.loadUser(); // safe, returns undefined if @if is false
  }

  selectReasoning(value: ChatRequestDto.ReasoningEnum | ReasoningDto.EffortEnum): void {
    this.reasoning.set(value as ReasoningDto.EffortEnum);
    const chatId = this.chatService.currentChatId();
    if (chatId) {
      this.chatMetaService.updateChatMetadata(chatId, { reasoningMode: value }).subscribe();
    }
  }

  private chatId?: string;
  ngOnInit(): void {
    this.loadChatList();
    this.loadModels();

    const chatId = this.route.snapshot.paramMap.get('chatId');
    this.chatService.currentChatId.set(chatId);
    this.chatId = chatId ?? undefined;
    if (chatId) {
      this.loadChatHistory(chatId);
      this.loadChatMeta(chatId);
    }
  }

  private loadChatMeta(chatId: string): void {
    this.chatMetaService.getChatMetadata(chatId).subscribe({
      next: (meta) => {
        const reasoningValue = meta.reasoningMode as ReasoningDto.EffortEnum | undefined;
        const match = this.models()?.find((m) => m.id === meta.usedModel);
        if (match) this.selectModel(match);
        if (reasoningValue) {
          this.reasoning.set(reasoningValue);
        }
      },
    });
  }

  ngOnDestroy(): void {
    this.chatService.destroy();
  }

  // ── Model management ──────────────────────────────────────────────────────

  private loadStoredModel(): ModelOpenAiDto | null {
    try {
      const raw = localStorage.getItem(OpenAiApi.MODEL_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ModelOpenAiDto) : null;
    } catch {
      return null;
    }
  }

  selectModel(model: ModelOpenAiDto): void {
    this.selectedModel.set(model);
    try {
      localStorage.setItem(OpenAiApi.MODEL_STORAGE_KEY, JSON.stringify(model));
    } catch {
      /* ignore */
    }
  }

  private loadModels(): void {
    this.modelsLoading.set(true);
    this.openAiService.getModelsOpenAi().subscribe({
      next: (models) => {
        this.models.set(models);
        if (!this.selectedModel() && models.length > 0) {
          this.selectModel(models[0]);
        } else if (this.selectedModel()) {
          const match = models.find((m) => m.id === this.selectedModel()!.id);
          if (match) this.selectModel(match);
        }
        this.modelsLoading.set(false);
      },
      error: () => this.modelsLoading.set(false),
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

  private fromContentToText(
    content:
      | string
      | Array<EasyInputMessageDtoContentInner>
      | Array<MessageDtoContentInner>
      | Array<ResponseOutputMessageDtoContentInner>
      | Array<ContentDto>,
    createdAt: string,
  ): ChatMessage[] {
    if (typeof content === 'string') {
      return [{ role: 'user', text: content, date: new Date(createdAt) }];
    }
    if (typeof content === 'object' && Array.isArray(content)) {
      return content.map((c) => {
        if (typeof c === 'string') {
          return { role: 'user', text: c, date: new Date(createdAt) };
        }
        if (c.type === ResponseInputTextDto.TypeEnum.InputText) {
          return { role: 'user', text: c.text, date: new Date(createdAt) };
        } else if (c.type === ResponseOutputRefusalDto.TypeEnum.Refusal) {
          return { role: 'user', text: c.refusal, date: new Date(createdAt) };
        } else if (c.type === ContentDto.TypeEnum.ReasoningText) {
          return { role: 'user', text: c.text, date: new Date(createdAt) };
        } else if (c.type === ResponseInputImageDto.TypeEnum.InputImage) {
          return { role: 'user', type: 'image', image: c.image_url, date: new Date(createdAt) };
        } else if (c.type === ResponseOutputTextDto.TypeEnum.OutputText) {
          return { role: 'user', text: c.text, date: new Date(createdAt) };
        } else if (c.type === ResponseInputFileDto.TypeEnum.InputFile) {
          return { role: 'user', file: c.file_data ?? c.file_url, date: new Date(createdAt) };
        }
        return { role: 'user', text: JSON.stringify(c), date: new Date(createdAt) };
      });
    }
    return [{ role: 'user', text: JSON.stringify(content), date: new Date(createdAt) }];
  }

  private loadChatHistory(chatId: string): void {
    this.isLoadingMessages.set(true);
    this.chatsApi.getChatEntries(chatId).subscribe((res) => {
      const messages: any[] = [];
      for (const entry of res) {
        if (typeof entry.request.input === 'string')
          messages.push({
            role: 'user',
            text: entry.request.input as string,
            date: new Date(entry.createdAt),
          });
        else if (typeof entry.request.input === 'object' && Array.isArray(entry.request.input)) {
          for (const inputEntry of entry.request.input) {
            if (
              inputEntry.type === 'message' ||
              (!inputEntry.type && (inputEntry as any).role !== 'developer')
            ) {
              if ((inputEntry as any).role !== 'system')
                messages.push(...this.fromContentToText(inputEntry.content, entry.createdAt));
            }
          }
        }

        const u = (entry.response as any)?.usage;
        const statsStr = u
          ? `${u.input_tokens} in · ${u.output_tokens} out${u.output_tokens_details?.reasoning_tokens ? ` · ${u.output_tokens_details.reasoning_tokens} reasoning` : ''}`
          : undefined;

        for (const output of entry.response.output) {
          if (output.type === 'reasoning') {
            const content =
              (output as any).content?.[0]?.text ?? (output as any).summary?.[0]?.text ?? '';
            messages.push({
              role: 'reasoning',
              text: content,
              date: new Date(entry.createdAt),
              collapsed: true,
            });
          } else {
            // @ts-ignore
            if (output.type === 'mcp_call' || output.type === 'tool_call') {
              const tc = output as any;
              let parsedOutput: string = tc.output ?? '';
              try {
                const arr = JSON.parse(parsedOutput);
                if (Array.isArray(arr) && arr[0]?.text != null) parsedOutput = arr[0].text;
              } catch {
                /* leave as-is */
              }
              messages.push({
                role: 'tool_call',
                text: tc.name ?? tc.tool ?? '',
                toolName: tc.name ?? tc.tool ?? '',
                toolArguments: tc.arguments
                  ? typeof tc.arguments === 'string'
                    ? JSON.parse(tc.arguments)
                    : tc.arguments
                  : undefined,
                toolOutput: parsedOutput || undefined,
                providerLabel: tc.server_label ?? tc.provider_info?.server_label ?? undefined,
                date: new Date(entry.createdAt),
                collapsed: true,
              });
            } else if (output.type === 'message') {
              const content = (output as any).content?.[0]?.text ?? (output as any).content ?? '';
              messages.push({
                role: 'ai',
                text: typeof content === 'string' ? content : JSON.stringify(content),
                date: new Date(entry.createdAt),
                stats: statsStr,
              });
            }
          }
        }
      }
      this.isLoadingMessages.set(false);
      this.chatService.chatMessages.set(messages);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Resolves the effective chat name to pass to submit() based on the
   * currently selected naming mode.
   *
   *  'ai'     → undefined  (backend interprets absence as "please auto-name")
   *             You may want to pass a dedicated flag instead — adjust to match
   *             your CreateChatMetadataDto contract.
   *  'custom' → trimmed user input (or undefined if left blank)
   *  'none'   → '' empty string, or a sentinel your backend recognises as
   *             "no name". Adjust as needed.
   */
  private resolvedChatName(): string | undefined {
    switch (this.newChatNameMode()) {
      case 'ai':
        return undefined; // backend auto-names
      case 'custom':
        return this.newChatName.trim() || undefined;
      case 'none':
        return ''; // explicit blank — adjust if your API needs a different sentinel
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  openChat(chatId: string): void {
    if (this.chatService.streaming()) return;
    this.chatService.chatMessages.set([]);
    this.chatService.currentChatId.set(chatId);
    this.router.navigate(['/chat-openai', chatId]);
    this.chatId = chatId;
    this.loadChatHistory(chatId);
    this.loadChatMeta(chatId);
  }

  newChat(): void {
    if (this.chatService.streaming()) return;
    this.chatService.chatMessages.set([]);
    this.chatService.currentChatId.set(null);
    this.router.navigate(['/chat-openai']);
    // Reset new-chat options to defaults
    this.newChatEndpointPreference.set('RESPONSES');
    this.newChatUseCrypto.set(false);
    this.newChatUseCryptoModel = false;
    this.newChatCryptoKey = '';
    this.newChatName = '';
    this.newChatNameMode.set('ai'); // reset to AI-decides default
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  submit(): void {
    if (this.chatId) {
      this.chatMetaService
        .getChatMetadata(this.chatId)
        .pipe(take(1))
        .subscribe((res) => {
          this.chatService.submit(
            this.selectedModel()?.id ?? '',
            this.reasoning(),
            this.appendedFiles(),
            res.useCrypto && res.cryptoKey ? res.cryptoKey : undefined,
            () => this.loadChatList(),
            undefined,
            () => this.infoRef()?.loadUser(),
          );

          this.chatInputRef?.clearFiles();
        });
      return;
    }

    this.chatService.submit(
      this.selectedModel()?.id ?? '',
      this.reasoning(),
      this.appendedFiles(),
      this.newChatUseCrypto() && this.newChatCryptoKey ? this.newChatCryptoKey : undefined,
      () => this.loadChatList(),
      {
        name: this.resolvedChatName(),
        letAiDecideChatName: this.newChatNameMode() === 'ai',
        useCrypto: this.newChatUseCrypto(),
        cryptoKey: this.newChatCryptoKey || undefined,
        openAiEndpointPreference: this.newChatEndpointPreference(),
        invokeAiModelToUse: this.invokeAiModelPreference(),
        useInvoke: this.newChatUseInvoke(),
      },
      () => this.infoRef()?.loadUser(),
    );

    this.chatInputRef?.clearFiles();
  }

  resend(): void {
    this.submit();
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
        if (this.chatService.currentChatId() === chatId) this.newChat();
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

  // ── Utilities ─────────────────────────────────────────────────────────────

  private scrollToBottom(ref?: ElementRef<HTMLElement>): void {
    if (!ref?.nativeElement) return;
    const el = ref.nativeElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= 50) {
      setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 0);
    }
  }
}
