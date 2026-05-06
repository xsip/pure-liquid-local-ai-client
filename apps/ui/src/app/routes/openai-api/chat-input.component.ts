import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  OnDestroy,
  output,
  signal,
  ViewChild,
  AfterViewChecked,
  inject,
} from '@angular/core';
import Prism from 'prismjs';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ChatMetadataService, ChatRequestDto, ReasoningDto } from '../../client';
import { ModelReasoningCapability } from '../../shared/components/reasoning-dropdown.component';
import { SendButtonComponent } from '../../shared/components/send-button.component';
import { ResetButtonComponent } from '../../shared/components/reset-button.component';
import { ReasoningDropdownComponent } from '../../shared/components/reasoning-dropdown.component';
import {
  AppendedFile,
  fileSizeLabel,
  mergeFiles,
  readFilesAsDataUrls,
} from '../../shared/utils/file.utils';
import { TranslateModule } from '@ngx-translate/core';
import { MarkdownPipe } from '../lm-studio-api/markdown.pipe';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPencilSquare,
  heroEye,
  heroLink,
  heroDocument,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { ChatService } from './chat.service';
import { Observable, of, Subject, switchMap, take } from 'rxjs';

// Re-export AppendedFile so existing consumers importing from this file keep working.
export type { AppendedFile };

@Component({
  selector: 'app-openai-chat-input',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    SendButtonComponent,
    ResetButtonComponent,
    ReasoningDropdownComponent,
    MarkdownPipe,
    NgIconComponent,
  ],
  viewProviders: [provideIcons({ heroPencilSquare, heroEye, heroLink, heroDocument, heroXMark })],
  styles: [
    `
      .md-editor-wrap {
        position: relative;
      }

      .md-raw-input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }

      .md-editable {
        min-height: 80px;
        max-height: 260px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
        caret-color: var(--color-accent);
        outline: none;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        line-height: 1.625;
        color: var(--color-text-primary);
      }

      .md-editable:empty::before {
        content: attr(data-placeholder);
        color: var(--color-text-disabled);
        pointer-events: none;
      }

      .md-preview {
        min-height: 80px;
        max-height: 260px;
        overflow-y: auto;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        line-height: 1.625;
        cursor: text;
      }

      .md-toggle {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.625rem;
        font-weight: 500;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        border: 1px solid transparent;
        transition: all 0.15s;
        cursor: pointer;
        user-select: none;
        line-height: 1.4;
      }
      .md-toggle:hover {
        opacity: 0.85;
      }
      .md-toggle--edit {
        color: var(--color-text-muted);
        border-color: var(--color-border-default);
      }
      .md-toggle--preview {
        color: var(--color-accent);
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 8%, transparent);
      }
    `,
  ],
  template: `
    <div
      class="shrink-0 px-4 py-3 relative"
      style="background: var(--color-surface-raised); border-top: 1px solid var(--color-border-subtle); box-shadow: 0 -4px 20px rgba(0,0,0,0.06);"
    >
      <form [formGroup]="form()" (ngSubmit)="submitted.emit()" class="flex flex-col gap-2">
        <!-- Editor wrapper -->
        <div
          class="md-editor-wrap relative group rounded-2xl overflow-hidden"
          style="background: var(--color-surface-base); border: 1px solid var(--color-border-default); box-shadow: var(--shadow-inset);"
        >
          <!-- Glow ring on focus -->
          <div
            class="absolute inset-0 rounded-2xl pointer-events-none transition-all duration-300"
            [style.opacity]="focused() ? 1 : 0"
            style="box-shadow: 0 0 0 2px var(--color-accent-glow);"
          ></div>

          <!-- Hidden textarea keeps FormGroup in sync -->
          <textarea
            #rawInput
            formControlName="input"
            class="md-raw-input"
            tabindex="-1"
            aria-hidden="true"
          ></textarea>

          <!-- EDIT mode: always in DOM so content survives toggle -->
          <div
            #editableDiv
            class="md-editable"
            contenteditable="true"
            [attr.data-placeholder]="'chatInput.placeholder' | translate"
            [hidden]="previewMode()"
            (input)="onEditableInput()"
            (keydown)="onKeydown($event)"
            (focus)="focused.set(true)"
            (blur)="focused.set(false)"
          ></div>

          <!-- PREVIEW mode: always in DOM, Prism re-highlights on each show -->
          <div
            #previewDiv
            class="md-preview markdown-body"
            [hidden]="!previewMode()"
            (click)="switchToEdit()"
            [innerHTML]="rawText() | markdown"
          ></div>

          <!-- Toggle pill -->
          <button
            type="button"
            class="md-toggle absolute top-2 right-2"
            [class]="previewMode() ? 'md-toggle--preview' : 'md-toggle--edit'"
            (click)="togglePreview()"
            [title]="previewMode() ? 'Back to editing' : 'Preview markdown'"
          >
            @if (previewMode()) {
              <ng-icon name="heroPencilSquare" class="w-2.5 h-2.5" />
              Edit
            } @else {
              <ng-icon name="heroEye" class="w-2.5 h-2.5" />
              Preview
            }
          </button>
        </div>

        <!-- Action row -->
        <div class="flex items-center gap-2 flex-wrap">
          <app-send-button [disabled]="form().invalid || streaming()" [streaming]="streaming()" />

          <app-reasoning-dropdown
            [reasoning]="reasoning()"
            [modelReasoningCap]="modelReasoningCap()"
            (reasoningChanged)="reasoningChanged.emit($event)"
          />

          <button
            type="button"
            (click)="fileInput.click()"
            [disabled]="streaming()"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-xl select-none disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all duration-150"
            [class]="
              appendedFiles().length > 0
                ? 'border-accent text-accent bg-accent/10 hover:bg-accent/20'
                : 'border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary'
            "
            [title]="'chatInput.attach' | translate"
          >
            <ng-icon name="heroLink" class="w-3.5 h-3.5 shrink-0" />
            <span>
              @if (appendedFiles().length > 0) {
                {{ appendedFiles().length }} file{{ appendedFiles().length === 1 ? '' : 's' }}
              } @else {
                {{ 'chatInput.attach' | translate }}
              }
            </span>
          </button>

          <input
            #fileInput
            type="file"
            multiple
            class="hidden"
            (change)="onFilesSelected($event)"
          />

          @if (streaming()) {
            <app-reset-button (clicked)="reset.emit()" />
          }

          @if (form().get('input')?.invalid && form().get('input')?.touched) {
            <p class="text-xs text-red-400">{{ 'chatInput.promptRequired' | translate }}</p>
          }

          <span class="ml-auto text-[10px] text-text-muted hidden sm:block">{{
            'chatInput.hint' | translate
          }}</span>
        </div>

        <!-- Attached files list -->
        @if (appendedFiles().length > 0) {
          <div class="flex flex-col gap-1 pt-1">
            <div class="text-[10px] text-text-muted uppercase tracking-widest mb-0.5">
              {{ 'chatInput.attachedFiles' | translate }}
            </div>
            @for (file of appendedFiles(); track file.filename; let i = $index) {
              <div
                class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-surface-base border border-border-default text-xs group hover:-translate-y-0.5 hover:shadow-depth-sm animate-slide-up transition-all duration-200"
              >
                <ng-icon name="heroDocument" class="w-3.5 h-3.5 shrink-0 text-text-muted" />
                <span class="truncate text-text-primary flex-1 max-w-xs">{{ file.filename }}</span>
                <span class="text-text-muted shrink-0 text-[10px]">{{
                  file.image_url ? fileSizeLabel(file.image_url) : file.sizeKb
                }}</span>
                <button
                  type="button"
                  (click)="removeFile(i)"
                  class="ml-1 shrink-0 flex items-center justify-center w-4 h-4 rounded text-text-muted hover:text-error-text hover:bg-error-bg active:scale-90 opacity-0 group-hover:opacity-100 transition-all duration-150"
                  [title]="'common.remove' | translate"
                >
                  <ng-icon name="heroXMark" class="w-3 h-3" />
                </button>
              </div>
            }
          </div>
        }
      </form>
    </div>
  `,
})
export class OpenAiChatInputComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('fileInput') private fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('editableDiv') private editableDivRef?: ElementRef<HTMLDivElement>;
  @ViewChild('previewDiv') private previewDivRef?: ElementRef<HTMLDivElement>;
  @ViewChild('rawInput') private rawInputRef!: ElementRef<HTMLTextAreaElement>;

  /** Set to true when we need to re-run Prism after the next view check. */
  private _needsPrismHighlight = false;

  readonly form = input.required<FormGroup>();
  readonly streaming = input.required<boolean>();
  readonly reasoning = input.required<
    ChatRequestDto.ReasoningEnum | ReasoningDto.EffortEnum | undefined
  >();
  readonly modelReasoningCap = input.required<ModelReasoningCapability | null>();
  readonly newChatIdProvider = input.required<() => Observable<string>>();

  readonly chatService = inject(ChatService);
  readonly chatMetadataService = inject(ChatMetadataService);

  readonly submitted = output<void>();
  readonly reset = output<void>();
  readonly reasoningChanged = output<ChatRequestDto.ReasoningEnum>();
  /** Emits the current file list every time it changes (add / remove / clear). */
  readonly appendedFilesChanged = output<AppendedFile[]>();

  readonly appendedFiles = signal<AppendedFile[]>([]);

  /** The raw (unrendered) markdown — this is what gets sent to the AI. */
  readonly rawText = signal<string>('');

  /** Whether the preview panel is active. */
  readonly previewMode = signal<boolean>(false);

  /** Focus state for the glow ring. */
  readonly focused = signal<boolean>(false);

  ngAfterViewInit(): void {
    const ctrl = this.form().get('input');
    if (ctrl?.value) {
      this.rawText.set(ctrl.value);
      this._syncEditableDiv(ctrl.value);
    }

    // Stay in sync if the parent patches the form control programmatically
    // (e.g. reply pre-fill or clear after send).
    ctrl?.valueChanges.subscribe((v: string) => {
      if (v !== this.rawText()) {
        this.rawText.set(v ?? '');
        this._syncEditableDiv(v ?? '');
      }
    });
  }

  ngOnDestroy(): void {
    /* no-op – subscription cleaned up by Angular */
  }

  // ── Editable div ────────────────────────────────────────────────────────────

  onEditableInput(): void {
    const el = this.editableDivRef?.nativeElement;
    if (!el) return;
    const text = el.innerText ?? '';
    this.rawText.set(text);
    // Patch the FormControl so validators and submit work normally.
    // emitEvent: false avoids the valueChanges loop.
    this.form().get('input')?.setValue(text, { emitEvent: false });
  }

  // ── Preview toggle ──────────────────────────────────────────────────────────

  togglePreview(): void {
    this.previewMode.update((v) => !v);
    if (this.previewMode()) {
      // Entering preview — schedule a Prism highlight pass
      this._needsPrismHighlight = true;
    } else {
      setTimeout(() => this._focusEditableAtEnd(), 0);
    }
  }

  switchToEdit(): void {
    if (this.previewMode()) {
      this.previewMode.set(false);
      setTimeout(() => this._focusEditableAtEnd(), 0);
    }
  }

  // ── AfterViewChecked ────────────────────────────────────────────────────────

  ngAfterViewChecked(): void {
    if (this._needsPrismHighlight && this.previewMode()) {
      const el = this.previewDivRef?.nativeElement;
      if (el) {
        Prism.highlightAllUnder(el);
      }
      this._needsPrismHighlight = false;
    }
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitted.emit();
    }
  }

  // ── Files ───────────────────────────────────────────────────────────────────

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    const file = files[0];
    if (['jpeg', 'jpg', 'png', 'svg'].includes(file.name.split('.')[1])) {
      readFilesAsDataUrls(files).then((newFiles) => {
        this.appendedFiles.update((existing) => {
          const merged = mergeFiles(existing, newFiles);
          this.appendedFilesChanged.emit(merged);
          return merged;
        });
      });
    } else {
      (this.chatService.currentChatId()
        ? of(this.chatService.currentChatId()!)
        : this.newChatIdProvider()()
      )
        .pipe(
          take(1),
          switchMap((chatId) => this.chatMetadataService.uploadFile(chatId, file)),
        )
        .subscribe((res) => {
          this.appendedFiles.update((existing) => {
            const merged = mergeFiles(existing, [
              {
                type: 'input_file',
                filename: res.filename,
                id: res.internalFilename,
                assetUrl: res.assetUrl,
                sizeKb: res.sizeKb,
              },
            ]);
            this.appendedFilesChanged.emit(merged);
            return merged;
          });
          console.log(res);
        });
    }
  }

  /*


   */

  removeFile(index: number): void {
    this.appendedFiles.update((files) => {
      const updated = files.filter((_, i) => i !== index);
      this.appendedFilesChanged.emit(updated);
      return updated;
    });
  }

  /** Called from the parent after a message is sent to clear the file list. */
  clearFiles(): void {
    this.appendedFiles.set([]);
    this.appendedFilesChanged.emit([]);
  }

  /**
   * Clears both the editable div and the form control.
   * Call this from the parent after a successful send instead of (or in
   * addition to) patching the form control directly.
   */
  clearInput(): void {
    this.rawText.set('');
    this.previewMode.set(false);
    const el = this.editableDivRef?.nativeElement;
    if (el) el.innerText = '';
    this.form().get('input')?.setValue('', { emitEvent: false });
  }

  fileSizeLabel(dataUrl: string): string {
    return fileSizeLabel(dataUrl);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _syncEditableDiv(text: string): void {
    const el = this.editableDivRef?.nativeElement;
    if (el && el.innerText !== text) {
      el.innerText = text;
    }
  }

  private _focusEditableAtEnd(): void {
    const el = this.editableDivRef?.nativeElement;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}
