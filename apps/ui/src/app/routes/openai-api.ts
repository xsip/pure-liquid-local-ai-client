import { animate, style, transition, trigger } from '@angular/animations';
import { Component, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AuthService,
  ChatMcpOverrideDto,
  ChatMetadataDto,
  ChatMetadataService,
  ChatsService,
  CreateChatMetadataDto,
  CustomMcpDto,
  MeDto,
  ReasoningEffort,
} from '../client';
import { ChatCompletionsService, ChatMessage } from './openai-api/chat-completions.service';
import { OpenAiModelSelectorComponent } from './openai-api/model-selector.component';

import { ChatSidebarComponent } from '../shared/components/chat-sidebar.component';
import { ChatMessagesComponent } from '../shared/components/chat-messages.component';
import { InfoComponent } from '../shared/components/info.component';
import { McpConfigDialogComponent } from '../shared/components/mcp-config-dialog.component';
import { SpinnerComponent } from '../shared/components/spinner.component';
import { AppendedFile, OpenAiChatInputComponent } from './openai-api/chat-input.component';
import { ToolApprovalBannerComponent } from './openai-api/tool-approval-banner.component';
import { interval, Observable, of, Subscription, switchMap, tap } from 'rxjs';
import { ButtonComponent, IconButtonComponent, LabelComponent, TextInputComponent, ToggleComponent } from '../shared';
import { TranslateModule } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowPath,
  heroBars3,
  heroChevronDown,
  heroCog6Tooth,
  heroPlus,
  heroSparkles,
  heroUser,
  heroXMark
} from '@ng-icons/heroicons/outline';
import { BlobBackgroundDirective } from '../shared/directives/blob-background.directive';
import { map } from 'rxjs/operators';
import { OpenAiModelService } from './openai-model.service';
import InvokeAiModelToUseEnum = ChatMetadataDto.InvokeAiModelToUseEnum;


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
    McpConfigDialogComponent,
    SpinnerComponent,
    ToolApprovalBannerComponent,
    TranslateModule,
    NgIconComponent,
    BlobBackgroundDirective,
  ],
  viewProviders: [
    provideIcons({
      heroBars3,
      heroUser,
      heroPlus,
      heroXMark,
      heroSparkles,
      heroArrowPath,
      heroChevronDown,
      heroCog6Tooth,
    }),
  ],
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
            [customMcps]="customMcps()"
            [currentChatGenerating]="activeChat.streaming()"
            (chatOpened)="openChat($event)"
            (commitRename)="onRename($event)"
            (chatDeleted)="deleteChat($event)"
            (openChatSettings)="onOpenChatSettings($event)"
            (saveCryptoSettings)="onSaveCryptoSettings($event)"
            (shareChat)="onShareChat($event)"
            (unshareChat)="onUnshareChat($event)"
            (accountMcpsChange)="customMcps.set($event)"
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
                    <!-- Audio transcription toggle -->
                    <div class="flex items-center justify-between">
                      <div class="flex flex-col items-start">
                        <ui-label>{{ 'chatSettings.transcribeAudio' | translate }}</ui-label>
                        <span class="text-[10px] text-text-muted mt-0.5 block">{{
                          'chatSettings.transcribeAudioHint' | translate
                        }}</span>
                      </div>
                      <ui-toggle
                        [ngModel]="newChatTranscribeAudio()"
                        [ngModelOptions]="{ standalone: true }"
                        activeColor="bg-amber-500"
                        (checkedChange)="newChatTranscribeAudio.set($event)"
                      />
                    </div>

                    <!-- Tool approval toggle -->
                    <div class="flex items-center justify-between">
                      <div class="flex flex-col items-start">
                        <ui-label>{{ 'chatSettings.toolsRequireApproval' | translate }}</ui-label>
                        <span class="text-[10px] text-text-muted mt-0.5 block">{{
                          'chatSettings.toolsRequireApprovalHint' | translate
                        }}</span>
                      </div>
                      <ui-toggle
                        [ngModel]="newChatToolsRequireApproval()"
                        [ngModelOptions]="{ standalone: true }"
                        activeColor="bg-amber-500"
                        (checkedChange)="newChatToolsRequireApproval.set($event)"
                      />
                    </div>

                    <!-- MCP servers -->
                    <div class="flex flex-col gap-1.5">
                      <div class="flex items-center justify-between">
                        <ui-label>{{ 'chatSettings.mcpServers' | translate }}</ui-label>
                        <button
                          type="button"
                          class="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
                          (click)="showMcpConfigDialog.set(true)"
                        >
                          <ng-icon name="heroCog6Tooth" class="w-3 h-3" />
                          {{ 'chatSettings.manageMcps' | translate }}
                        </button>
                      </div>
                      @if (customMcps().length) {
                        <span class="text-[10px] text-text-muted -mt-1 block">{{
                          'chatSettings.mcpServersHint' | translate
                        }}</span>
                        <div class="flex flex-col gap-2">
                          @for (mcp of customMcps(); track mcp.id) {
                            <div
                              class="rounded-xl border border-border-default bg-surface-overlay/40 overflow-hidden transition-colors"
                              [class.opacity-60]="newChatDisabledMcpIds().has(mcp.id)"
                            >
                              <div class="flex items-center gap-2 px-3 py-2.5">
                                <button
                                  type="button"
                                  class="flex items-center gap-1.5 flex-1 min-w-0 text-left disabled:cursor-default"
                                  [disabled]="!mcp.availableTools.length"
                                  (click)="toggleNewChatMcpExpanded(mcp.id)"
                                >
                                  @if (mcp.availableTools.length) {
                                    <ng-icon
                                      name="heroChevronDown"
                                      class="w-3 h-3 shrink-0 text-text-muted transition-transform"
                                      [class.rotate-180]="!isNewChatMcpExpanded(mcp.id)"
                                    />
                                  }
                                  <span class="flex flex-col min-w-0">
                                    <span class="text-xs font-medium text-text-primary truncate">{{
                                      mcp.name
                                    }}</span>
                                    <span class="text-text-muted truncate" style="font-size:10px">{{
                                      mcp.endpoint
                                    }}</span>
                                  </span>
                                </button>
                                <ui-icon-button
                                  size="sm"
                                  [title]="'info.mcpRefresh' | translate"
                                  [disabled]="refreshingMcpId() === mcp.id"
                                  (clicked)="refreshNewChatMcp(mcp)"
                                >
                                  @if (refreshingMcpId() === mcp.id) {
                                    <app-spinner size="sm" />
                                  } @else {
                                    <ng-icon name="heroArrowPath" class="w-3 h-3" />
                                  }
                                </ui-icon-button>
                                <ui-toggle
                                  [ngModel]="!newChatDisabledMcpIds().has(mcp.id)"
                                  [ngModelOptions]="{ standalone: true }"
                                  (checkedChange)="toggleNewChatMcp(mcp.id, $event)"
                                />
                              </div>
                              @if (isNewChatMcpExpanded(mcp.id) && mcp.availableTools.length) {
                                <div
                                  class="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-border-subtle"
                                >
                                  @for (tool of mcp.availableTools; track tool) {
                                    <button
                                      type="button"
                                      class="flex items-center gap-1 pl-2 pr-2.5 py-1 rounded-lg border text-[10px] font-mono transition-colors mt-1.5"
                                      [class]="
                                        getNewChatAllowedTools(mcp).includes(tool)
                                          ? 'border-accent/40 bg-accent-subtle text-accent'
                                          : 'border-border-default text-text-muted hover:border-border-strong'
                                      "
                                      (click)="toggleNewChatTool(mcp, tool)"
                                    >
                                      {{ tool }}
                                    </button>
                                  }
                                </div>
                              }
                            </div>
                          }
                        </div>
                      } @else {
                        <p class="text-[10px] text-text-muted">{{ 'info.noMcpServers' | translate }}</p>
                      }
                    </div>
                  </div>
                }

                @if (showMcpConfigDialog()) {
                  <app-mcp-config-dialog
                    [customMcps]="customMcps()"
                    (customMcpsChange)="customMcps.set($event)"
                    (closed)="showMcpConfigDialog.set(false)"
                  />
                }
              </app-chat-messages>
            </div>

            @if (activeChat.pendingToolApproval(); as pendingApproval) {
              <app-tool-approval-banner
                [request]="pendingApproval"
                (decision)="activeChat.resolveToolApproval($event)"
              />
            }

            <app-openai-chat-input
              #chatInput
              [form]="activeChat.form"
              [streaming]="activeChat.streaming()"
              [locked]="activeChat.locked()"
              [generating]="activeChat.generating()"
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
              <app-info (userLoaded)="onUserLoaded($event)" />
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
  readonly showInfoPanel = signal(true);
  readonly chatList = signal<any[]>([]);
  readonly chatsLoading = signal(false);
  readonly appendedFiles = signal<AppendedFile[]>([]);
  readonly isLoadingMessages = signal(false);

  // ── New-chat options ───────────────────────────────────────────────────────
  readonly newChatEndpointPreference =
    signal<CreateChatMetadataDto.OpenAiEndpointPreferenceEnum>('COMPLETION');
  readonly newChatUseCrypto = signal(false);
  readonly newChatUseInvoke = signal(true);
  readonly newChatTranscribeAudio = signal(false);
  readonly newChatToolsRequireApproval = signal(false);
  readonly invokeAiModelPreference = signal<InvokeAiModelToUseEnum>('Dreamshaper 8');
  /** User's account-level custom MCP servers, all enabled by default for a new chat. */
  readonly customMcps = signal<CustomMcpDto[]>([]);
  /** Servers the user opted out of for the chat currently being created. */
  readonly newChatDisabledMcpIds = signal<Set<string>>(new Set());
  /** Per-server tool selection overrides for the chat currently being created (mcpId -> allowedTools). */
  readonly newChatToolOverrides = signal<Map<string, string[]>>(new Map());
  private readonly newChatExpandedMcpIds = signal<Set<string>>(new Set());
  readonly showMcpConfigDialog = signal(false);
  readonly refreshingMcpId = signal<string | null>(null);
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
  /** Model used by the currently open chat, shown above AI messages. */
  private usedModel?: string;
  /** Self-heals stale `locked` flags in the sidebar list — e.g. after
   * navigating away from a chat we were resuming/watching, we stop getting
   * told when its generation finishes, so its "generating" dot would
   * otherwise stay on until something else happens to refresh the list. */
  private staleLockCheckSub?: Subscription;

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
        transcribeAudio: this.newChatTranscribeAudio(),
        toolsRequireApproval: this.newChatToolsRequireApproval(),
        reasoningMode: this.modelService.reasoning()! as string,
        mcpOverrides: this.buildNewChatMcpOverrides(),
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

  /** Keeps this route's account snapshot (username, custom MCP servers) in sync
   * whenever the info panel reloads or the user edits MCP servers there — so the
   * New Chat dialog and chat settings dialog reflect changes without a refresh. */
  onUserLoaded(me: MeDto): void {
    this.currentUsername = me.username;
    this.customMcps.set(me.customMcps ?? []);
  }

  ngOnInit(): void {
    this.loadChatList();
    this.modelService.loadModels();

    this.staleLockCheckSub = interval(5000)
      .pipe(switchMap(() => this.chatMetaService.listChatMetadata()))
      .subscribe({
        next: (list) => {
          const anyLocked = list.some((c) => c.locked);
          const staleLocked = this.chatList().some((c) => c.locked);
          if (!anyLocked && !staleLocked) return;
          const sorted = [...list].sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          });
          this.chatList.set(sorted);
        },
      });
    this.authService.getMe().subscribe({
      next: (me) => {
        this.currentUsername = me.username;
        this.customMcps.set(me.customMcps ?? []);
      },
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
    this.staleLockCheckSub?.unsubscribe();
  }

  // ── Model management ──────────────────────────────────────────────────────

  private loadChatMeta(chatId: string): void {
    this.chatMetaService.getChatMetadata(chatId).subscribe({
      next: (meta) => {
        this.activeChat.currentChatId.set(chatId);
        this.usedModel = meta.usedModel;
        this.loadCompletionsChatHistory(chatId, () => {
          // Already generating when we loaded this chat — most likely we
          // refreshed mid-response. Attach to the live stream right away
          // instead of waiting for the next lock poll. Chained after history
          // loads so the resumed echo/delta messages land on top of it
          // rather than risking the history load overwriting them.
          if (meta.locked) {
            this.chatCompletionsService.resumeStreaming(chatId, meta.usedModel ?? '', () => {
              this.loadCompletionsChatHistory(chatId);
              this.loadChatList();
            });
          }
        });

        // Only shared chats need ongoing polling — another user could start
        // a new generation while we're looking at this chat.
        this.chatCompletionsService.updateLockPolling(
          chatId,
          (meta.sharedWith?.length ?? 0) > 0,
          meta.usedModel ?? '',
          () => {
            this.loadCompletionsChatHistory(chatId);
            this.loadChatList();
          },
        );

        const reasoningValue = meta.reasoningMode as ReasoningEffort | undefined;
        const match = this.modelService.models()?.find((m) => m.id === meta.usedModel);
        if (match) this.modelService.selectModel(match);
        if (reasoningValue) {
          this.modelService.setEffort(reasoningValue);
        }
      },
    });
  }

  // ── Chat list ─────────────────────────────────────────────────────────────

  loadChatList(silent = false): void {
    if (!silent) this.chatsLoading.set(true);
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
  private loadCompletionsChatHistory(chatId: string, onLoaded?: () => void): void {
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
        const sender = senderByIndex[index];
        const username = !sender || sender === this.currentUsername ? 'You' : sender;
        if (m.role === 'user') {
          if (Array.isArray(m.content)) {
            for (const part of m.content) {
              if (part?.type === 'image_url' && part.image_url?.url) {
                messages.push({ role: 'user', text: '', image: part.image_url.url, date, username });
              }
              // Reaches here only when transcription is off (or the audio wasn't
              // userRecorded) — a transcribed part is stored as plain text
              // (`transcribed: true`) instead, handled by extractCompletionsMessageText below.
              if (part?.type === 'input_audio' && part.input_audio?.data) {
                const format = part.input_audio.format ?? 'wav';
                messages.push({
                  role: 'user',
                  text: '',
                  audio: `data:audio/${format};base64,${part.input_audio.data}`,
                  date,
                  username,
                });
              }
            }
          }
          const text = this.extractCompletionsMessageText(m.content);
          const transcribed =
            Array.isArray(m.content) && m.content.some((p: any) => p?.transcribed);
          if (text) messages.push({ role: 'user', text, audioHidden: transcribed, date, username });
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
      onLoaded?.();
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
    if (this.activeChat.currentChatId() === chatId) return;
    // Detach from whatever this route was streaming/resuming — the server-side
    // generation keeps running in the background regardless (see resumeStreaming),
    // we just stop routing its deltas into the chat we're about to leave.
    this.activeChat.reset();
    this.chatCompletionsService.chatMessages.set([]);
    this.router.navigate(['/chat-openai', chatId]);
    this.chatId = chatId;
    this.loadChatMeta(chatId);
  }

  toggleNewChatMcp(id: string, enabled: boolean): void {
    this.newChatDisabledMcpIds.update((set) => {
      const next = new Set(set);
      enabled ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isNewChatMcpExpanded(id: string): boolean {
    return this.newChatExpandedMcpIds().has(id);
  }

  toggleNewChatMcpExpanded(id: string): void {
    this.newChatExpandedMcpIds.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  getNewChatAllowedTools(mcp: CustomMcpDto): string[] {
    return this.newChatToolOverrides().get(mcp.id) ?? mcp.allowedTools;
  }

  toggleNewChatTool(mcp: CustomMcpDto, tool: string): void {
    const current = this.getNewChatAllowedTools(mcp);
    const next = current.includes(tool) ? current.filter((t) => t !== tool) : [...current, tool];
    this.newChatToolOverrides.update((map) => new Map(map).set(mcp.id, next));
  }

  refreshNewChatMcp(mcp: CustomMcpDto): void {
    this.refreshingMcpId.set(mcp.id);
    this.authService.refreshCustomMcpServer(mcp.id).subscribe({
      next: (updated) => {
        this.customMcps.update((list) => list.map((m) => (m.id === mcp.id ? updated : m)));
        this.newChatToolOverrides.update((map) => {
          const override = map.get(mcp.id);
          if (!override) return map;
          const kept = override.filter((t) => updated.availableTools.includes(t));
          const brandNew = updated.availableTools.filter((t) => !mcp.availableTools.includes(t));
          return new Map(map).set(mcp.id, [...kept, ...brandNew]);
        });
        this.refreshingMcpId.set(null);
      },
      error: () => this.refreshingMcpId.set(null),
    });
  }

  private buildNewChatMcpOverrides(): ChatMcpOverrideDto[] {
    const disabled = this.newChatDisabledMcpIds();
    const toolOverrides = this.newChatToolOverrides();
    return this.customMcps()
      .filter((mcp) => disabled.has(mcp.id) || toolOverrides.has(mcp.id))
      .map((mcp) => ({
        mcpId: mcp.id,
        active: !disabled.has(mcp.id),
        allowedTools: disabled.has(mcp.id) ? [] : (toolOverrides.get(mcp.id) ?? mcp.allowedTools),
      }));
  }

  newChat(): void {
    this.activeChat.reset();
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
    this.newChatDisabledMcpIds.set(new Set());
    this.newChatToolOverrides.set(new Map());
    this.newChatTranscribeAudio.set(false);
    this.newChatToolsRequireApproval.set(false);
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  submit(): void {
    if (this.chatId) {
      this.chatCompletionsService.submit(
        this.modelService.selectedModel()?.id ?? '',
        this.modelService.reasoning() as ReasoningEffort,
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
      this.modelService.reasoning() as ReasoningEffort,
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
        transcribeAudio: this.newChatTranscribeAudio(),
        toolsRequireApproval: this.newChatToolsRequireApproval(),
        mcpOverrides: this.buildNewChatMcpOverrides(),
      },
    );
    this.chatInputRef?.clearFiles();
  }

  resend(): void {
    this.submit();
  }

  selectReasoning(value: ReasoningEffort): void {
    this.modelService.setEffort(value as ReasoningEffort);
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
          chat.mcpOverrides ?? [],
          chat.transcribeAudio ?? false,
          chat.toolsRequireApproval ?? false,
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
    mcpOverrides,
    transcribeAudio,
    toolsRequireApproval,
  }: {
    chatId: string;
    name: string;
    useCrypto: boolean;
    cryptoKey: string;
    useInvoke: boolean;
    invokeAiModelToUse?: InvokeAiModelToUseEnum;
    mcpOverrides?: ChatMcpOverrideDto[];
    transcribeAudio?: boolean;
    toolsRequireApproval?: boolean;
  }): void {
    this.chatMetaService
      .updateChatMetadata(chatId, {
        name,
        useCrypto,
        cryptoKey,
        invokeAiModelToUse,
        useInvoke,
        mcpOverrides,
        transcribeAudio,
        toolsRequireApproval,
      })
      .subscribe({
        next: () => {
          this.chatList.update((list) =>
            list.map((c) => (c._id === chatId ? { ...c, name, useCrypto } : c)),
          );
        },
      });
  }

  onShareChat({ chatId, username }: { chatId: string; username: string }): void {
    this.chatMetaService.shareChatMetadata(chatId, { username }).subscribe({
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
        this.chatSidebarRef?.setShareError(err?.error?.message ?? `User "${username}" not found`);
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
