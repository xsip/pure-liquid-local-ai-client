import { animate, style, transition, trigger } from '@angular/animations';
import { Component, ElementRef, input, output, signal, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMetadataDto, CreateChatMetadataDto, UpdateChatMetadataDto } from '../../client';
import {
  ChatSettingsData,
  ChatSettingsDialogComponent,
  ChatSettingsSaveEvent
} from '../../shared/components/chat-settings-dialog.component';
import { SpinnerComponent } from '../../shared/components/spinner.component';
import { TranslateModule } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroBackspace,
  heroChatBubbleOvalLeft,
  heroCog6Tooth,
  heroLockClosed,
  heroPaperClip,
  heroPencilSquare,
  heroPlus,
  heroTrash,
  heroUserPlus,
  heroXMark
} from '@ng-icons/heroicons/outline';
import { BadgeComponent, IconButtonComponent } from '../../shared';
import { AuthImageMountDirective, CodeBlockMountDirective, FileCardMountDirective } from './markdown.pipe';
import { ChatAttachmentsSidebarComponent } from '../../shared/components/chat-attachments-sidebar.component';
import ClientEnum = CreateChatMetadataDto.ClientEnum;
import InvokeAiModelToUseEnum = UpdateChatMetadataDto.InvokeAiModelToUseEnum;

@Component({
  selector: 'app-chat-sidebar',
  animations: [
    trigger('chatItemAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-12px)' }),
        animate(
          '220ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateX(0)' }),
        ),
      ]),
    ]),
    trigger('newChatAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-8px)' }),
        animate(
          '200ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
    ]),
    trigger('ctxMenuAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.90)', transformOrigin: 'top left' }),
        animate(
          '180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'scale(1)' }),
        ),
      ]),
      transition(':leave', [
        animate('120ms ease-in', style({ opacity: 0, transform: 'scale(0.94)' })),
      ]),
    ]),
  ],
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    TranslateModule,
    ChatSettingsDialogComponent,
    SpinnerComponent,
    NgIconComponent,
    BadgeComponent,
    IconButtonComponent,
    ChatAttachmentsSidebarComponent,
    AuthImageMountDirective,
    CodeBlockMountDirective,
    FileCardMountDirective,
  ],
  viewProviders: [
    provideIcons({
      heroChatBubbleOvalLeft,
      heroPlus,
      heroLockClosed,
      heroPencilSquare,
      heroCog6Tooth,
      heroTrash,
      heroPaperClip,
      heroBackspace,
      heroUserPlus,
      heroXMark,
    }),
  ],
  template: `
    <div
      mountAuthImages
      mountCodeBlocks
      mountFileCards
      class="flex flex-col w-70 border-r border-border-default shrink-0 h-full bg-surface-raised"
      style="box-shadow: 2px 0 12px rgba(0,0,0,0.06);"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0"
      >
        <div class="flex items-center gap-2">
          @if (generatedFilesModalContent()) {
            <ui-icon-button (clicked)="closeGeneratedFiles()">
              <ng-icon name="heroBackspace" class="w-3.5 h-3.5 text-text-muted" />
            </ui-icon-button>
          }

          @if (generatedFilesModalContent()) {
            <ng-icon name="heroPaperClip" class="w-3.5 h-3.5 text-text-muted" />
          } @else {
            <ng-icon name="heroChatBubbleOvalLeft" class="w-3.5 h-3.5 text-text-muted" />
          }
          <span class="text-[10px] text-text-muted uppercase tracking-[0.14em] font-semibold">{{
            (generatedFilesModalContent()
              ? generatedFilesModelType() === 'generated'
                ? 'sidebar.generatedFiles'
                : 'sidebar.uploadedFiles'
              : 'sidebar.history'
            ) | translate
          }}</span>
        </div>
        @if (chatsLoading()) {
          <app-spinner />
        }
      </div>

      @if (!generatedFilesModalContent()) {
        <!-- New chat button -->
        <div class="px-2 pt-2 pb-1 shrink-0">
          <button
            type="button"
            (click)="newChat.emit()"
            class="w-full flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl border group active:scale-[0.98] transition-all duration-200"
            @newChatAnim
            [class]="
              !currentChatId()
                ? 'bg-accent-subtle border-accent/40 text-accent shadow-depth-sm'
                : 'border-border-default text-text-secondary hover:bg-surface-overlay hover:border-border-strong hover:text-text-primary'
            "
          >
            <div
              class="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all duration-200"
              [style]="
                !currentChatId()
                  ? 'background: var(--color-accent); box-shadow: 0 2px 8px var(--color-accent-glow);'
                  : 'background: var(--color-surface-sunken);'
              "
            >
              <ng-icon
                name="heroPlus"
                class="w-3 h-3"
                [class]="!currentChatId() ? 'text-white' : 'text-text-muted'"
              />
            </div>
            <span class="font-medium">{{ 'sidebar.newChat' | translate }}</span>
          </button>
        </div>

        <!-- Chat list -->
        <div class="flex-1 overflow-y-auto py-1 min-h-0 px-2 flex flex-col gap-0.5">
          @if (filteredChats.length === 0 && !chatsLoading()) {
            <div
              class="flex flex-col items-center justify-center h-full gap-2 text-center px-3 py-8"
            >
              <ng-icon
                name="heroChatBubbleOvalLeft"
                class="w-8 h-8 text-text-disabled animate-float"
              />
              <span class="text-[10px] text-text-disabled uppercase tracking-wider">{{
                'sidebar.noChats' | translate
              }}</span>
            </div>
          }

          @for (chat of filteredChats; track chat._id) {
            @if (renamingChatId() === chat._id) {
              <div class="px-1 py-1">
                <input
                  #renameInput
                  type="text"
                  [value]="renameValue()"
                  (input)="renameValue.set($any($event.target).value)"
                  (keydown)="onRenameKeydown($event, chat._id!)"
                  (blur)="
                    commitRename.emit({ chatId: chat._id!, name: renameValue() });
                    renamingChatId.set(null)
                  "
                  class="w-full bg-surface-base border border-accent rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  [placeholder]="'sidebar.chatNamePlaceholder' | translate"
                />
              </div>
            } @else {
              <button
                type="button"
                (click)="chatOpened.emit(chat._id!)"
                (contextmenu)="onContextMenu($event, chat)"
                class="w-full text-left px-2.5 py-2 text-xs rounded-xl group relative active:scale-[0.98] transition-all duration-200"
                @chatItemAnim
                [class]="
                  currentChatId() === chat._id
                    ? 'bg-accent-subtle text-text-primary shadow-depth-sm'
                    : 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
                "
              >
                <!-- Active indicator -->
                @if (currentChatId() === chat._id) {
                  <div
                    class="absolute left-0 top-1/4 -translate-y-1/4 w-0.5 h-3/4 rounded-r-full bg-accent"
                  ></div>
                }
                <div class="flex items-center gap-1.5 pl-1">
                  @if (chat.useCrypto) {
                    <ng-icon name="heroLockClosed" class="w-2.5 h-2.5 shrink-0 text-amber-400/80" />
                  }
                  <div class="truncate font-medium leading-tight">{{ chat.name ?? 'Chat' }}</div>
                </div>
                @if (chat.lastMessageSentAt) {
                  <div class="text-text-muted mt-0.5 text-[10px] pl-1">
                    {{ chat.lastMessageSentAt | date: 'dd MMM, HH:mm' }}
                  </div>
                }
                @if (currentChatId() === chat._id) {
                  <div class="border-t border-border-subtle mx-2 my-1"></div>

                  <button
                    @chatItemAnim
                    type="button"
                    (click)="$event.stopPropagation(); openGeneratedFiles(chat, 'generated')"
                    class="w-full flex items-center rounded-md gap-2.5 px-3 py-1.5 mb-1 text-xs text-text-secondary hover:bg-secondary-accent-subtle hover:text-text-primary transition-colors text-left"
                  >
                    <ng-icon name="heroPaperClip" class="w-3.5 h-3.5 shrink-0 opacity-60" />
                    {{ 'sidebar.generatedFiles' | translate }}
                    <ui-badge [variant]="'accent'">{{ getAssetsLength(chat) }} </ui-badge>
                  </button>
                  <div class="border-t border-border-subtle mx-2 my-1"></div>

                  <button
                    @chatItemAnim
                    type="button"
                    (click)="$event.stopPropagation(); openGeneratedFiles(chat, 'user')"
                    class="w-full flex items-center rounded-md gap-2.5 px-3 py-1.5 mb-1 text-xs text-text-secondary hover:bg-secondary-accent-subtle hover:text-text-primary transition-colors text-left"
                  >
                    <ng-icon name="heroPaperClip" class="w-3.5 h-3.5 shrink-0 opacity-60" />
                    {{ 'sidebar.uploadedFiles' | translate }}
                    <ui-badge [variant]="'accent'">{{ getUserFilesLength(chat) }} </ui-badge>
                  </button>
                }
              </button>
            }
          }
        </div>
      } @else {
        <!-- Generated files panel -->
        <app-chat-attachments-sidebar
          [assetsType]="generatedFilesModelType()!"
          [chat]="generatedFilesModalContent()"
        />
      }
    </div>

    <!-- Context menu -->
    @if (ctxMenu(); as menu) {
      <div
        class="fixed inset-0 z-40"
        (click)="closeCtxMenu()"
        (contextmenu)="$event.preventDefault(); closeCtxMenu()"
      ></div>
      <div
        class="fixed z-50 w-52 bg-surface-raised border border-border-default rounded-2xl overflow-hidden py-1"
        @ctxMenuAnim
        style="box-shadow: var(--shadow-xl); left: {{ menu.x }}px; top: {{ menu.y }}px;"
        [style.left.px]="menu.x"
        [style.top.px]="menu.y"
      >
        <div
          class="px-3 py-2 text-[10px] text-text-muted uppercase tracking-widest border-b border-border-subtle truncate font-semibold"
        >
          {{ chatNameById(menu.chat._id!) }}
        </div>

        <div class="px-2 pt-2 pb-1">
          <input
            #ctxRenameInput
            type="text"
            [value]="ctxRenameValue()"
            (input)="ctxRenameValue.set($any($event.target).value)"
            (keydown)="onCtxRenameKeydown($event, menu.chat._id!)"
            class="w-full bg-surface-base border border-border-default focus:border-accent rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none transition-colors"
            [placeholder]="'sidebar.chatNamePlaceholder' | translate"
          />
        </div>

        <button
          type="button"
          (click)="commitCtxRename(menu.chat._id!)"
          class="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay hover:text-text-primary active:scale-[0.98] text-left"
        >
          <ng-icon name="heroPencilSquare" class="w-3.5 h-3.5 shrink-0 opacity-60" />
          {{ 'sidebar.rename' | translate }}
        </button>
        <div class="border-t border-border-subtle mx-2 my-1"></div>

        <button
          type="button"
          (click)="openGeneratedFiles(menu.chat, 'generated')"
          class="w-full flex items-center gap-2.5 px-3 py-1.5 mb-1 text-xs text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors text-left"
        >
          <ng-icon name="heroPaperClip" class="w-3.5 h-3.5 shrink-0 opacity-60" />
          {{ 'sidebar.generatedFiles' | translate }}
          <ui-badge [variant]="'accent'">{{ menu.chat.generatedAssets?.length ?? 0 }}</ui-badge>
        </button>

        <div class="border-t border-border-subtle mx-2 my-1"></div>
        <button
          type="button"
          (click)="openGeneratedFiles(menu.chat, 'user')"
          class="w-full flex items-center gap-2.5 px-3 py-1.5 mb-1 text-xs text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors text-left"
        >
          <ng-icon name="heroPaperClip" class="w-3.5 h-3.5 shrink-0 opacity-60" />
          {{ 'sidebar.uploadedFiles' | translate }}
          <ui-badge [variant]="'accent'">{{ menu.chat.userAssets?.length ?? 0 }}</ui-badge>
        </button>

        <div class="border-t border-border-subtle mx-2 my-1"></div>

        <button
          type="button"
          (click)="openSettings(menu.chat)"
          class="w-full flex items-center gap-2.5 px-3 py-1.5 mb-1 text-xs text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors text-left"
        >
          <ng-icon name="heroCog6Tooth" class="w-3.5 h-3.5 shrink-0 opacity-60" />
          {{ 'sidebar.settings' | translate }}
        </button>

        <button
          type="button"
          (click)="openShare(menu.chat)"
          class="w-full flex items-center gap-2.5 px-3 py-1.5 mb-1 text-xs text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors text-left"
        >
          <ng-icon name="heroUserPlus" class="w-3.5 h-3.5 shrink-0 opacity-60" />
          {{ 'sidebar.share' | translate }}
          @if (menu.chat.sharedWithUsernames?.length) {
            <ui-badge [variant]="'accent'">{{ menu.chat.sharedWithUsernames?.length }}</ui-badge>
          }
        </button>

        <div class="border-t border-border-subtle mx-2 mb-1"></div>

        @if (!ctxConfirmDelete()) {
          <button
            type="button"
            (click)="ctxConfirmDelete.set(true)"
            class="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-error-text/70 hover:bg-error-bg hover:text-error-text active:scale-[0.98] text-left"
          >
            <ng-icon name="heroTrash" class="w-3.5 h-3.5 shrink-0" />
            {{ 'sidebar.deleteChat' | translate }}
          </button>
        } @else {
          <div class="px-3 py-2 flex flex-col gap-2">
            <span class="text-[10px] text-error-text uppercase tracking-widest font-semibold">{{
              'sidebar.deleteConfirm' | translate
            }}</span>
            <div class="flex gap-1.5">
              <button
                type="button"
                (click)="chatDeleted.emit(menu.chat._id!); closeCtxMenu()"
                class="flex-1 px-2 py-1.5 text-xs bg-error-text hover:opacity-90 text-white rounded-lg transition-colors font-semibold"
              >
                {{ 'sidebar.delete' | translate }}
              </button>
              <button
                type="button"
                (click)="ctxConfirmDelete.set(false)"
                class="flex-1 px-2 py-1.5 text-xs border border-border-default hover:border-border-strong text-text-secondary hover:text-text-primary rounded-lg transition-colors"
              >
                {{ 'sidebar.cancel' | translate }}
              </button>
            </div>
          </div>
        }
      </div>
    }

    <!-- Chat Settings dialog -->
    @if (settingsModal(); as modal) {
      <app-chat-settings-dialog
        [data]="modal"
        [loading]="settingsLoading()"
        [showCrypto]="client() === 'OPENAI'"
        [showInvoke]="client() === 'OPENAI'"
        (saved)="onSettingsSaved($event)"
        (closed)="closeSettings()"
      />
    }

    <!-- Share dialog -->
    @if (shareModal(); as modal) {
      <div class="fixed inset-0 z-40 bg-black/40" (click)="closeShare()"></div>
      <div
        class="fixed z-50 w-80 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-raised border border-border-default rounded-2xl overflow-hidden"
        style="box-shadow: var(--shadow-xl);"
      >
        <div
          class="px-4 py-3 text-xs text-text-muted uppercase tracking-widest border-b border-border-subtle truncate font-semibold flex items-center justify-between"
        >
          <span>{{ 'sidebar.shareChat' | translate }} — {{ modal.chatName }}</span>
          <button type="button" (click)="closeShare()" class="text-text-muted hover:text-text-primary">
            <ng-icon name="heroXMark" class="w-4 h-4" />
          </button>
        </div>

        <div class="p-4 flex flex-col gap-3">
          <div class="flex gap-1.5">
            <input
              #shareUsernameInputEl
              type="text"
              [value]="shareUsername()"
              (input)="shareUsername.set($any($event.target).value); shareError.set(null)"
              (keydown.enter)="submitShare(modal.chatId)"
              class="flex-1 bg-surface-base border border-border-default focus:border-accent rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none transition-colors"
              [placeholder]="'sidebar.shareUsernamePlaceholder' | translate"
            />
            <button
              type="button"
              (click)="submitShare(modal.chatId)"
              [disabled]="!shareUsername().trim()"
              class="px-3 py-1.5 text-xs bg-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
            >
              {{ 'sidebar.share' | translate }}
            </button>
          </div>
          @if (shareError(); as err) {
            <span class="text-[10px] text-error-text">{{ err }}</span>
          }

          @if (modal.sharedWithUsernames.length) {
            <div class="flex flex-col gap-1 pt-1 border-t border-border-subtle">
              <span class="text-[10px] text-text-muted uppercase tracking-widest pt-2">{{
                'sidebar.sharedWith' | translate
              }}</span>
              @for (username of modal.sharedWithUsernames; track username; let i = $index) {
                <div
                  class="flex items-center justify-between px-2 py-1.5 rounded-lg bg-surface-base border border-border-default text-xs"
                >
                  <span class="text-text-primary truncate">{{ username }}</span>
                  <button
                    type="button"
                    (click)="revokeShare(modal.chatId, modal.sharedWith[i])"
                    class="text-text-muted hover:text-error-text shrink-0"
                    [title]="'sidebar.revokeAccess' | translate"
                  >
                    <ng-icon name="heroXMark" class="w-3.5 h-3.5" />
                  </button>
                </div>
              }
            </div>
          } @else {
            <span class="text-[10px] text-text-muted">{{ 'sidebar.notSharedYet' | translate }}</span>
          }
        </div>
      </div>
    }
  `,
})
export class ChatSidebarComponent {
  readonly client = input.required<ClientEnum>();
  readonly chatList = input.required<ChatMetadataDto[]>();
  readonly chatsLoading = input.required<boolean>();
  readonly currentChatId = input.required<string | null>();

  readonly chatOpened = output<string>();
  readonly commitRename = output<{ chatId: string; name: string }>();
  readonly newChat = output<void>();
  readonly chatDeleted = output<string>();
  readonly openChatSettings = output<string>();
  readonly saveCryptoSettings = output<ChatSettingsSaveEvent>();
  readonly shareChat = output<{ chatId: string; username: string }>();
  readonly unshareChat = output<{ chatId: string; userId: string }>();

  @ViewChild('renameInput') renameInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('ctxRenameInput') ctxRenameInputRef?: ElementRef<HTMLInputElement>;

  readonly renamingChatId = signal<string | null>(null);
  readonly renameValue = signal('');

  readonly ctxMenu = signal<{ chat: ChatMetadataDto; x: number; y: number } | null>(null);
  readonly ctxConfirmDelete = signal(false);
  readonly ctxRenameValue = signal('');

  readonly settingsModal = signal<ChatSettingsData | null>(null);
  readonly generatedFilesModalContent = signal<ChatMetadataDto | null>(null);
  readonly generatedFilesModelType = signal<'generated' | 'user' | null>(null);
  readonly settingsLoading = signal(false);

  readonly shareModal = signal<{
    chatId: string;
    chatName: string;
    sharedWith: string[];
    sharedWithUsernames: string[];
  } | null>(null);
  readonly shareUsername = signal('');
  readonly shareError = signal<string | null>(null);

  chatNameById(chatId: string): string {
    return this.chatList().find((c) => c._id === chatId)?.name ?? 'Chat';
  }

  onContextMenu(event: MouseEvent, chat: ChatMetadataDto): void {
    event.preventDefault();
    event.stopPropagation();
    const menuW = 216,
      menuH = 270;
    const x = Math.min(event.clientX, window.innerWidth - menuW);
    const y = Math.min(event.clientY, window.innerHeight - menuH);
    this.ctxConfirmDelete.set(false);
    this.ctxRenameValue.set(chat.name ?? '');
    this.ctxMenu.set({ chat, x, y });
    setTimeout(() => this.ctxRenameInputRef?.nativeElement?.focus(), 0);
  }

  closeCtxMenu(): void {
    this.ctxMenu.set(null);
    this.ctxConfirmDelete.set(false);
  }

  onCtxRenameKeydown(event: KeyboardEvent, chatId: string): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitCtxRename(chatId);
    } else if (event.key === 'Escape') {
      this.closeCtxMenu();
    }
  }

  commitCtxRename(chatId: string): void {
    const name = this.ctxRenameValue().trim();
    if (name && name !== this.chatNameById(chatId)) {
      this.commitRename.emit({ chatId, name });
    }
    this.closeCtxMenu();
  }

  onRenameKeydown(event: KeyboardEvent, chatId: string): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitRename.emit({ chatId, name: this.renameValue() });
      this.renamingChatId.set(null);
    } else if (event.key === 'Escape') {
      this.renamingChatId.set(null);
    }
  }

  startRename(chatId: string): void {
    this.renameValue.set(this.chatNameById(chatId));
    this.renamingChatId.set(chatId);
    setTimeout(() => this.renameInputRef?.nativeElement?.select(), 0);
  }

  openGeneratedFiles(chat: ChatMetadataDto, type: 'generated' | 'user'): void {
    this.closeCtxMenu();
    this.generatedFilesModelType.set(type);
    this.generatedFilesModalContent.set(chat);
  }

  getAssetsLength(chat: ChatMetadataDto) {
    return chat.generatedAssets?.filter((asset) => asset.isVisible).length ?? 0;
  }
  getUserFilesLength(chat: ChatMetadataDto) {
    return chat.userAssets?.filter((asset) => asset.isVisible).length ?? 0;
  }

  openSettings(chat: ChatMetadataDto): void {
    this.closeCtxMenu();
    this.settingsLoading.set(true);
    this.settingsModal.set({
      chatId: chat._id!,
      chatName: chat.name ?? 'Chat',
      name: chat.name ?? '',
      useCrypto: false,
      cryptoKey: '',
      useInvoke: chat.useInvoke ?? false,
      invokeAiModelToUse: chat.invokeAiModelToUse,
    });
    this.openChatSettings.emit(chat._id!);
  }

  /** Called by parent after getChatMetadata resolves to populate the form. */
  loadSettingsData(
    name: string,
    useCrypto: boolean,
    cryptoKey: string,
    useInvoke: boolean,
    invokeAiModelToUse?: InvokeAiModelToUseEnum,
  ): void {
    this.settingsModal.update((m) =>
      m ? { ...m, name, useCrypto, cryptoKey, invokeAiModelToUse, useInvoke } : null,
    );
    this.settingsLoading.set(false);
  }

  closeSettings(): void {
    this.settingsModal.set(null);
    this.settingsLoading.set(false);
  }

  openShare(chat: ChatMetadataDto): void {
    this.closeCtxMenu();
    this.shareUsername.set('');
    this.shareError.set(null);
    this.shareModal.set({
      chatId: chat._id!,
      chatName: chat.name ?? 'Chat',
      sharedWith: chat.sharedWith ?? [],
      sharedWithUsernames: chat.sharedWithUsernames ?? [],
    });
  }

  closeShare(): void {
    this.shareModal.set(null);
    this.shareUsername.set('');
    this.shareError.set(null);
  }

  submitShare(chatId: string): void {
    const username = this.shareUsername().trim();
    if (!username) return;
    this.shareChat.emit({ chatId, username });
  }

  revokeShare(chatId: string, userId: string): void {
    this.unshareChat.emit({ chatId, userId });
  }

  /** Called by the parent after a share/unshare API call resolves. */
  updateShareResult(sharedWith: string[], sharedWithUsernames: string[]): void {
    this.shareModal.update((m) => (m ? { ...m, sharedWith, sharedWithUsernames } : null));
    this.shareUsername.set('');
    this.shareError.set(null);
  }

  /** Called by the parent when a share/unshare API call fails. */
  setShareError(message: string): void {
    this.shareError.set(message);
  }

  closeGeneratedFiles(): void {
    this.generatedFilesModalContent.set(null);
  }

  onSettingsSaved(event: ChatSettingsSaveEvent): void {
    this.saveCryptoSettings.emit(event);
    this.closeSettings();
  }

  get filteredChats() {
    return this.chatList()
      .filter((chat) => chat.client === this.client())
      .sort((a, b) => {
        const dateA = new Date(a.lastMessageSentAt ?? 0).getTime();
        const dateB = new Date(b.lastMessageSentAt ?? 0).getTime();
        return dateB - dateA;
      });
  }
}
