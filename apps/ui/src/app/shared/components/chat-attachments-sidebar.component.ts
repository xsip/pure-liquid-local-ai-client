import { animate, style, transition, trigger } from '@angular/animations';
import { Component, computed, input, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArchiveBox,
  heroArrowDownTray,
  heroDocument,
  heroFilm,
  heroMusicalNote,
  heroPaperClip,
  heroPhoto,
  heroTableCells,
  heroXMark,
  heroMagnifyingGlass,
} from '@ng-icons/heroicons/outline';
import {
  AuthFilesDirective,
  AuthImageComponent,
  AuthImageMountDirective,
  CodeBlockMountDirective,
  FileCardComponent,
  FileCardMountDirective,
} from '../../routes/lm-studio-api/markdown.pipe';
import { ChatMetadataDto } from '../../client';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';

interface FileTypeConfig {
  icon: string;
  iconClass: string;
  extClass: string;
}

const FILE_TYPE_MAP: Record<string, FileTypeConfig> = {
  pdf: { icon: 'heroDocument', iconClass: 'text-error-text', extClass: 'text-error-text' },
  doc: { icon: 'heroDocument', iconClass: 'text-accent-text', extClass: 'text-accent-text' },
  docx: { icon: 'heroDocument', iconClass: 'text-accent-text', extClass: 'text-accent-text' },
  xls: { icon: 'heroTableCells', iconClass: 'text-success-text', extClass: 'text-success-text' },
  xlsx: { icon: 'heroTableCells', iconClass: 'text-success-text', extClass: 'text-success-text' },
  csv: { icon: 'heroTableCells', iconClass: 'text-success-text', extClass: 'text-success-text' },
  zip: {
    icon: 'heroArchiveBox',
    iconClass: 'text-tertiary-accent-text',
    extClass: 'text-tertiary-accent-text',
  },
  tar: {
    icon: 'heroArchiveBox',
    iconClass: 'text-tertiary-accent-text',
    extClass: 'text-tertiary-accent-text',
  },
  gz: {
    icon: 'heroArchiveBox',
    iconClass: 'text-tertiary-accent-text',
    extClass: 'text-tertiary-accent-text',
  },
  mp4: {
    icon: 'heroFilm',
    iconClass: 'text-secondary-accent-text',
    extClass: 'text-secondary-accent-text',
  },
  mov: {
    icon: 'heroFilm',
    iconClass: 'text-secondary-accent-text',
    extClass: 'text-secondary-accent-text',
  },
  mp3: {
    icon: 'heroMusicalNote',
    iconClass: 'text-secondary-accent-text',
    extClass: 'text-secondary-accent-text',
  },
  wav: {
    icon: 'heroMusicalNote',
    iconClass: 'text-secondary-accent-text',
    extClass: 'text-secondary-accent-text',
  },
  png: {
    icon: 'heroPhoto',
    iconClass: 'text-secondary-accent-text',
    extClass: 'text-secondary-accent-text',
  },
  jpg: {
    icon: 'heroPhoto',
    iconClass: 'text-secondary-accent-text',
    extClass: 'text-secondary-accent-text',
  },
  jpeg: {
    icon: 'heroPhoto',
    iconClass: 'text-secondary-accent-text',
    extClass: 'text-secondary-accent-text',
  },
  gif: {
    icon: 'heroPhoto',
    iconClass: 'text-secondary-accent-text',
    extClass: 'text-secondary-accent-text',
  },
  svg: {
    icon: 'heroPhoto',
    iconClass: 'text-secondary-accent-text',
    extClass: 'text-secondary-accent-text',
  },
};

const FILE_TYPE_FALLBACK: FileTypeConfig = {
  icon: 'heroDocument',
  iconClass: 'text-text-muted',
  extClass: 'text-text-muted',
};

@Component({
  selector: 'app-chat-attachments-sidebar',
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
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    NgIconComponent,
    AuthImageMountDirective,
    CodeBlockMountDirective,
    FileCardMountDirective,
    AuthImageComponent,
    AuthFilesDirective,
    FileCardComponent,
  ],
  viewProviders: [
    provideIcons({
      heroPaperClip,
      heroDocument,
      heroTableCells,
      heroArchiveBox,
      heroFilm,
      heroMusicalNote,
      heroPhoto,
      heroArrowDownTray,
      heroXMark,
      heroMagnifyingGlass,
    }),
  ],
  template: `
    <!-- Search input -->
    <div class="px-2 pt-2 pb-1">
      <div class="relative flex items-center">
        <ng-icon
          name="heroMagnifyingGlass"
          class="absolute left-2.5 w-3.5 h-3.5 text-text-disabled pointer-events-none"
        />
        <input
          type="text"
          [formControl]="searchControl"
          placeholder="{{ 'sidebar.searchFiles' | translate }}"
          class="w-full bg-surface-overlay/40 hover:bg-surface-overlay focus:bg-surface-overlay border border-transparent focus:border-border-subtle text-xs text-text-primary placeholder:text-text-disabled rounded-lg pl-7 pr-7 py-1.5 outline-none transition-all duration-150"
        />
        @if (searchControl.value) {
          <button
            type="button"
            (click)="clearSearch()"
            class="absolute right-2 flex items-center justify-center w-4 h-4 rounded-full text-text-disabled hover:text-text-secondary transition-colors"
          >
            <ng-icon name="heroXMark" class="w-3 h-3" />
          </button>
        }
      </div>
    </div>

    <!-- File list -->
    <div
      class="flex-1 overflow-y-auto py-1 min-h-0 px-2 flex flex-col gap-0.5"
      mountAuthImages
      mountCodeBlocks
      mountFileCards
      authFiles
    >
      @if (chat()?.generatedAssets?.length === 0) {
        <div class="flex flex-col items-center justify-center h-full gap-2 text-center px-3 py-8">
          <ng-icon name="heroPaperClip" class="w-8 h-8 text-text-disabled animate-float" />
          <span class="text-[10px] text-text-disabled uppercase tracking-wider">{{
            'sidebar.noGeneratedFiles' | translate
          }}</span>
        </div>
      } @else if (filteredAssets().length === 0) {
        <div class="flex flex-col items-center justify-center h-full gap-2 text-center px-3 py-8">
          <ng-icon name="heroMagnifyingGlass" class="w-8 h-8 text-text-disabled" />
          <span class="text-[10px] text-text-disabled uppercase tracking-wider">{{
            'sidebar.noSearchResults' | translate
          }}</span>
        </div>
      } @else {
        @for (asset of filteredAssets(); track asset._id) {
          @if (asset.type === 'FILE') {
            <app-file-card
              [filename]="asset.filename ?? ''"
              [url]="asset.url ?? ''"
              [ext]="fileExt(asset.mimeType)"
              [mimeType]="asset.mimeType"
              [size]="asset.sizeKb ?? 0"
              [style]="'sidebar'"
              @chatItemAnim
            />
          } @else if (asset.type === 'IMAGE' && asset.thumbnail) {
            <button
              type="button"
              class="w-full flex flex-col gap-2 text-left px-2.5 py-2 text-xs rounded-xl group relative active:scale-[0.98] transition-all duration-200 text-text-secondary bg-surface-overlay/40 hover:bg-surface-overlay hover:text-text-primary"
              @chatItemAnim
            >
              <div class="relative">
                <app-auth-image [authSrc]="asset.thumbnail" />
                <div
                  class="flex absolute bottom-0 left-0 w-full bg-surface-overlay/80 items-center gap-1.5 pl-1"
                >
                  <div class="truncate font-medium leading-tight">{{ asset.filename }}</div>
                </div>
              </div>
            </button>
          }
        }
      }
    </div>
  `,
})
export class ChatAttachmentsSidebarComponent implements OnInit, OnDestroy {
  readonly chat = input.required<ChatMetadataDto | null>();

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  /** Debounced search query kept in a signal so `filteredAssets` stays reactive. */
  readonly searchQuery = signal('');

  readonly filteredAssets = computed(() => {
    const assets = this.chat()?.generatedAssets ?? [];
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => asset.filename?.toLowerCase().includes(query));
  });

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => this.searchQuery.set(value));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  clearSearch(): void {
    this.searchControl.reset('');
  }

  fileExt(filename?: string | null): string {
    return filename?.split('/').pop()?.toLowerCase() ?? 'file';
  }

  fileTypeConfig(filename?: string | null): FileTypeConfig {
    return FILE_TYPE_MAP[this.fileExt(filename)] ?? FILE_TYPE_FALLBACK;
  }
}
