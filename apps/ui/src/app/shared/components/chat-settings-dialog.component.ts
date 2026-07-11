import { Component, inject, input, output, signal, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ModalComponent } from './ui/modal.component';
import { ButtonComponent } from './ui/button.component';
import { LabelComponent } from './ui/label.component';
import { TextInputComponent } from './ui/text-input.component';
import { ToggleComponent } from './ui/toggle.component';
import { SpinnerComponent } from './spinner.component';
import { IconButtonComponent } from './ui/icon-button.component';
import { McpConfigDialogComponent } from './mcp-config-dialog.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowPath, heroChevronDown, heroCog6Tooth } from '@ng-icons/heroicons/outline';
import { AuthService, ChatMcpOverrideDto, ChatMetadataDto, CustomMcpDto } from '../../client';
import InvokeAiModelToUseEnum = ChatMetadataDto.InvokeAiModelToUseEnum;

export interface ChatSettingsData {
  chatId: string;
  chatName: string;
  name: string;
  useCrypto: boolean;
  cryptoKey: string;
  useInvoke: boolean;
  invokeAiModelToUse?: InvokeAiModelToUseEnum;
  transcribeAudio?: boolean;
  customMcps: CustomMcpDto[];
  mcpOverrides: ChatMcpOverrideDto[];
}

export interface ChatSettingsSaveEvent {
  chatId: string;
  name: string;
  useCrypto: boolean;
  cryptoKey: string;
  useInvoke: boolean;
  invokeAiModelToUse?: InvokeAiModelToUseEnum;
  transcribeAudio?: boolean;
  mcpOverrides: ChatMcpOverrideDto[];
}

/** Per-chat editable state for one custom MCP server. */
interface McpUiState {
  mcp: CustomMcpDto;
  active: boolean;
  allowedTools: string[];
  expanded: boolean;
}

@Component({
  selector: 'app-chat-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalComponent,
    ButtonComponent,
    LabelComponent,
    TextInputComponent,
    ToggleComponent,
    SpinnerComponent,
    IconButtonComponent,
    McpConfigDialogComponent,
    NgIconComponent,
  ],
  viewProviders: [provideIcons({ heroChevronDown, heroArrowPath, heroCog6Tooth })],
  template: `
    <ui-modal size="lg" (closed)="closed.emit()">
      <span slot="header">{{ 'chatSettings.title' | translate }}</span>

      <div
        class="text-[10px] text-text-muted uppercase tracking-widest mb-4 truncate border-b border-border-default pb-2"
      >
        {{ data().chatName }}
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-6">
          <app-spinner size="md" />
        </div>
      } @else {
        <!-- Chat name -->
        <div class="mb-4">
          <ui-label class="mb-1.5">{{ 'chatSettings.chatNameLabel' | translate }}</ui-label>
          <ui-text-input
            [(ngModel)]="localName"
            [placeholder]="'chatSettings.chatNamePlaceholder' | translate"
          />
        </div>

        @if (showCrypto()) {
          <!-- Encryption toggle -->
          <div class="flex items-center justify-between mb-4">
            <div>
              <ui-label>{{ 'chatSettings.encryption' | translate }}</ui-label>
              <span class="text-[10px] text-text-muted mt-0.5 block">{{
                'chatSettings.encryptionHint' | translate
              }}</span>
            </div>
            <ui-toggle [(ngModel)]="localUseCrypto" activeColor="bg-amber-500" />
          </div>

          <!-- Crypto key input -->
          @if (localUseCrypto) {
            <div class="mb-4">
              <ui-label class="mb-1.5">{{ 'chatSettings.encryptionKey' | translate }}</ui-label>
              <ui-text-input
                type="password"
                [showToggle]="true"
                [mono]="true"
                [(ngModel)]="localCryptoKey"
                [placeholder]="'chatSettings.encryptionKeyPlaceholder' | translate"
              />
            </div>
          }
        }

        @if (showInvoke()) {
          <!-- Invoke AI toggle -->
          <div class="flex items-center justify-between">
            <div>
              <ui-label>{{ 'chatSettings.invoke' | translate }}</ui-label>
              <span class="text-[10px] text-text-muted mt-0.5 block">{{
                'chatSettings.invokeHint' | translate
              }}</span>
            </div>
            <ui-toggle [(ngModel)]="localUseInvoke" activeColor="bg-amber-500" />
          </div>
          @if (localUseInvoke) {
            <div class="self-center w-full mt-1.5">
              <ui-label class="mb-1.5 {{ !localUseInvoke ? 'opacity-0.5' : '' }}"
                >{{ 'toolbar.invokeModel' | translate }}
              </ui-label>
              <div class="flex w-full mt-2 gap-2">
                <ui-button
                  [disabled]="!localUseInvoke"
                  class="flex-1"
                  size="md"
                  variant="secondary"
                  [active]="localInvokeAiModelPreference === 'Juggernaut XL v9'"
                  (clicked)="localInvokeAiModelPreference = 'Juggernaut XL v9'"
                  ><p class="p-1.5">Juggernaut XL v9</p>
                  <div class="absolute top-0 right-2 text-[10px] text-warn">sdxl</div>
                </ui-button>
                <ui-button
                  class="flex-1"
                  size="md"
                  variant="secondary"
                  [disabled]="!localUseInvoke"
                  [active]="localInvokeAiModelPreference === 'Dreamshaper 8'"
                  (clicked)="localInvokeAiModelPreference = 'Dreamshaper 8'"
                  ><p class="p-1.5">Dreamshaper 8</p>
                  <div class="absolute top-0 right-2 text-[10px] text-warn">sd 1.5</div>
                </ui-button>
              </div>
            </div>
          }
        }

        @if (showTranscribeAudio()) {
          <!-- Audio transcription toggle -->
          <div class="flex items-center justify-between mb-4">
            <div>
              <ui-label>{{ 'chatSettings.transcribeAudio' | translate }}</ui-label>
              <span class="text-[10px] text-text-muted mt-0.5 block">{{
                'chatSettings.transcribeAudioHint' | translate
              }}</span>
            </div>
            <ui-toggle [(ngModel)]="localTranscribeAudio" activeColor="bg-amber-500" />
          </div>
        }

        <div class="mb-4 mt-2">
          <div class="flex items-center justify-between mb-1.5">
            <ui-label>{{ 'chatSettings.mcpServers' | translate }}</ui-label>
            <button
              type="button"
              class="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
              (click)="showManageMcps.set(true)"
            >
              <ng-icon name="heroCog6Tooth" class="w-3 h-3" />
              {{ 'chatSettings.manageMcps' | translate }}
            </button>
          </div>
          <div class="flex flex-col mt-2 gap-2">
            @if (localMcpState.length || data().customMcps.length) {
              @for (state of localMcpState; track state.mcp.id) {
                <div
                  class="rounded-xl border border-border-default bg-surface-overlay/40 overflow-hidden transition-colors"
                  [class.opacity-60]="!state.active"
                >
                  <div class="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      class="flex items-center gap-1.5 flex-1 min-w-0 text-left disabled:cursor-default"
                      [disabled]="!state.mcp.availableTools.length"
                      (click)="state.expanded = !state.expanded"
                    >
                      @if (state.mcp.availableTools.length) {
                        <ng-icon
                          name="heroChevronDown"
                          class="w-3 h-3 shrink-0 text-text-muted transition-transform"
                          [class.rotate-180]="!state.expanded"
                        />
                      }
                      <span class="flex flex-col min-w-0">
                        <span class="text-xs font-medium text-text-primary truncate">{{
                          state.mcp.name
                        }}</span>
                        <span class="text-text-muted truncate" style="font-size:10px">{{
                          state.mcp.endpoint
                        }}</span>
                      </span>
                    </button>
                    <ui-icon-button
                      size="sm"
                      [title]="'info.mcpRefresh' | translate"
                      [disabled]="refreshingId() === state.mcp.id"
                      (clicked)="refreshMcp(state)"
                    >
                      @if (refreshingId() === state.mcp.id) {
                        <app-spinner size="sm" />
                      } @else {
                        <ng-icon name="heroArrowPath" class="w-3 h-3" />
                      }
                    </ui-icon-button>
                    <ui-toggle [(ngModel)]="state.active" activeColor="bg-amber-500" />
                  </div>
                  @if (state.expanded && state.mcp.availableTools.length) {
                    <div
                      class="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-border-subtle"
                    >
                      @for (tool of state.mcp.availableTools; track tool) {
                        <button
                          type="button"
                          class="flex items-center gap-1 pl-2 pr-2.5 py-1 rounded-lg border text-[10px] font-mono transition-colors mt-1.5"
                          [class]="
                            state.allowedTools.includes(tool)
                              ? 'border-accent/40 bg-accent-subtle text-accent'
                              : 'border-border-default text-text-muted hover:border-border-strong'
                          "
                          (click)="toggleTool(state, tool)"
                        >
                          {{ tool }}
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            } @else {
              <p class="text-text-muted text-center py-6 text-xs">
                {{ 'info.noMcpServers' | translate }}
              </p>
            }
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 pt-1">
          <ui-button variant="primary" class="flex-1" (clicked)="save()"
            >{{ 'chatSettings.save' | translate }}
          </ui-button>
          <ui-button variant="secondary" class="flex-1" (clicked)="closed.emit()"
            >{{ 'chatSettings.cancel' | translate }}
          </ui-button>
        </div>
      }
    </ui-modal>

    @if (showManageMcps()) {
      <app-mcp-config-dialog
        [customMcps]="data().customMcps"
        (customMcpsChange)="onAccountMcpsChange($event)"
        (closed)="showManageMcps.set(false)"
      />
    }
  `,
})
export class ChatSettingsDialogComponent implements OnChanges, OnInit {
  private readonly authService = inject(AuthService);

  readonly data = input.required<ChatSettingsData>();
  readonly loading = input<boolean>(false);
  readonly showCrypto = input<boolean>(false);
  readonly showInvoke = input<boolean>(false);
  readonly showTranscribeAudio = input<boolean>(false);

  readonly saved = output<ChatSettingsSaveEvent>();
  readonly closed = output<void>();
  /** Emits the full, updated account-level MCP server list whenever it changes
   * here (inline refresh or the embedded manage dialog) so ancestor routes stay in sync. */
  readonly accountMcpsChange = output<CustomMcpDto[]>();

  readonly showManageMcps = signal(false);
  readonly refreshingId = signal<string | null>(null);

  localName = '';
  localUseCrypto = false;
  localUseInvoke = false;
  localCryptoKey = '';
  localInvokeAiModelPreference?: InvokeAiModelToUseEnum;
  localTranscribeAudio = false;
  localMcpState: McpUiState[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) this.applyData();
  }

  ngOnInit() {
    this.applyData();
  }

  private applyData(): void {
    const d = this.data();
    this.localName = d.name;
    this.localUseCrypto = d.useCrypto;
    this.localCryptoKey = d.cryptoKey;
    this.localUseInvoke = d.useInvoke;
    this.localInvokeAiModelPreference = d.invokeAiModelToUse;
    this.localTranscribeAudio = d.transcribeAudio ?? false;

    this.localMcpState = (d.customMcps ?? []).map((mcp) => {
      const override = (d.mcpOverrides ?? []).find((o) => o.mcpId === mcp.id);
      return {
        mcp,
        active: override ? override.active : true,
        allowedTools: override ? override.allowedTools : mcp.allowedTools,
        expanded: false,
      };
    });
  }

  toggleTool(state: McpUiState, tool: string): void {
    state.allowedTools = state.allowedTools.includes(tool)
      ? state.allowedTools.filter((t) => t !== tool)
      : [...state.allowedTools, tool];
  }

  refreshMcp(state: McpUiState): void {
    this.refreshingId.set(state.mcp.id);
    this.authService.refreshCustomMcpServer(state.mcp.id).subscribe({
      next: (updated) => {
        const kept = state.allowedTools.filter((t) => updated.availableTools.includes(t));
        const brandNew = updated.availableTools.filter(
          (t) => !state.mcp.availableTools.includes(t),
        );
        state.mcp = updated;
        state.allowedTools = [...kept, ...brandNew];
        this.refreshingId.set(null);
        this.accountMcpsChange.emit(
          this.data().customMcps.map((m) => (m.id === updated.id ? updated : m)),
        );
      },
      error: () => this.refreshingId.set(null),
    });
  }

  /** Called by the embedded manage dialog whenever servers are added/removed/edited. */
  onAccountMcpsChange(customMcps: CustomMcpDto[]): void {
    this.localMcpState = customMcps.map((mcp) => {
      const existing = this.localMcpState.find((s) => s.mcp.id === mcp.id);
      return existing
        ? { ...existing, mcp }
        : { mcp, active: true, allowedTools: mcp.allowedTools, expanded: false };
    });
    this.accountMcpsChange.emit(customMcps);
  }

  save(): void {
    const d = this.data();
    const mcpOverrides: ChatMcpOverrideDto[] = this.localMcpState
      .filter(
        (state) =>
          !state.active ||
          state.allowedTools.length !== state.mcp.allowedTools.length ||
          state.allowedTools.some((t) => !state.mcp.allowedTools.includes(t)),
      )
      .map((state) => ({
        mcpId: state.mcp.id,
        active: state.active,
        allowedTools: state.allowedTools,
      }));

    this.saved.emit({
      chatId: d.chatId,
      name: this.localName.trim() || d.chatName,
      useCrypto: this.localUseCrypto,
      cryptoKey: this.localCryptoKey,
      useInvoke: this.localUseInvoke,
      invokeAiModelToUse: this.localInvokeAiModelPreference,
      transcribeAudio: this.localTranscribeAudio,
      mcpOverrides,
    });
  }
}
