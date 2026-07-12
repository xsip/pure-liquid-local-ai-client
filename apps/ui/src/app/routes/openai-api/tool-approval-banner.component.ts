import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroWrenchScrewdriver } from '@ng-icons/heroicons/outline';
import { ToolApprovalRequiredEvent } from './completions-openai-stream.service';

@Component({
  selector: 'app-tool-approval-banner',
  standalone: true,
  imports: [CommonModule, TranslateModule, NgIconComponent],
  viewProviders: [provideIcons({ heroWrenchScrewdriver })],
  template: `
    <div
      class="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-tool-border/50 bg-tool-bg text-tool-text text-xs mb-2"
    >
      <ng-icon name="heroWrenchScrewdriver" class="w-4 h-4 shrink-0 text-tool-muted" />
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate">
          {{ 'toolApproval.title' | translate }}: {{ request().name }}
        </div>
        @if (request().arguments && objectKeys(request().arguments!).length) {
          <div class="text-tool-muted/70 text-[10px] font-mono truncate">
            {{ request().arguments | json }}
          </div>
        }
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          (click)="decision.emit('deny')"
          class="px-2.5 py-1 rounded-lg border border-error-border text-error-text hover:bg-error-bg transition-colors active:scale-95"
        >
          {{ 'toolApproval.deny' | translate }}
        </button>
        <button
          type="button"
          (click)="decision.emit('always')"
          class="px-2.5 py-1 rounded-lg border border-border-default hover:border-border-strong transition-colors active:scale-95"
        >
          {{ 'toolApproval.always' | translate }}
        </button>
        <button
          type="button"
          (click)="decision.emit('approve')"
          class="px-2.5 py-1 rounded-lg border border-accent/40 bg-accent-subtle text-accent hover:border-accent transition-colors active:scale-95"
        >
          {{ 'toolApproval.once' | translate }}
        </button>
      </div>
    </div>
  `,
})
export class ToolApprovalBannerComponent {
  readonly request = input.required<ToolApprovalRequiredEvent>();
  readonly decision = output<'approve' | 'deny' | 'always'>();

  objectKeys(obj: Record<string, unknown>): string[] {
    return Object.keys(obj);
  }
}
