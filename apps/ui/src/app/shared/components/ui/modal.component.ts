import { animate, style, transition, trigger, state } from '@angular/animations';
import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

/**
 * Reusable modal shell — backdrop + centred card.
 * Content is projected via ng-content slots:
 *
 *   [slot="header"]  — title row (gets a close button appended automatically)
 *   (default slot)   — body
 *
 * Usage:
 *   <ui-modal (closed)="closeModal()">
 *     <span slot="header">Chat Settings</span>
 *     <p>body content here…</p>
 *   </ui-modal>
 */
@Component({
  selector: 'ui-modal',
  animations: [
    trigger('backdropAnim', [
      transition(':enter', [
        style({ opacity: 0, backdropFilter: 'blur(0px)' }),
        animate('200ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 })),
      ]),
    ]),
    trigger('cardAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.88) translateY(12px)' }),
        animate('280ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ opacity: 1, transform: 'scale(1) translateY(0)' })),
      ]),
      transition(':leave', [
        animate('150ms cubic-bezier(0.4, 0, 1, 1)', style({ opacity: 0, transform: 'scale(0.94) translateY(6px)' })),
      ]),
    ]),
  ],
  standalone: true,
  imports: [TranslateModule, NgIconComponent],
  viewProviders: [provideIcons({ heroXMark })],
  template: `
    <!-- backdrop -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @backdropAnim
      (click)="closed.emit()"
    >
      <!-- card -->
      <div
        class="relative bg-surface-raised border border-border-default rounded-2xl shadow-depth-xl p-6 max-h-[85vh] flex flex-col"
        [class]="widthClass()"
        @cardAnim
        style="box-shadow: var(--shadow-xl);"
        (click)="$event.stopPropagation()"
      >
        <!-- header row -->
        <div class="flex items-center justify-between mb-5 shrink-0">
          <h3 class="text-sm font-semibold text-text-primary tracking-wide">
            <ng-content select="[slot=header]" />
          </h3>
          <button
            type="button"
            (click)="closed.emit()"
            class="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay active:scale-90"
            [title]="'common.close' | translate"
          >
            <ng-icon name="heroXMark" class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- body -->
        <div class="overflow-y-auto min-h-0">
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly size = input<'md' | 'lg'>('md');
  readonly closed = output<void>();

  widthClass(): string {
    return this.size() === 'lg' ? 'w-[34rem] max-w-[92vw]' : 'w-88';
  }
}
