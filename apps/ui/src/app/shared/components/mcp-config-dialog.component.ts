import { Component, OnChanges, SimpleChanges, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowPath, heroChevronDown, heroPlus, heroServerStack, heroTrash } from '@ng-icons/heroicons/outline';
import { AuthService, CustomMcpDto } from '../../client';
import { ModalComponent } from './ui/modal.component';
import { ButtonComponent } from './ui/button.component';
import { IconButtonComponent } from './ui/icon-button.component';
import { TextInputComponent } from './ui/text-input.component';
import { ToggleComponent } from './ui/toggle.component';
import { SpinnerComponent } from './spinner.component';
import { TooltipDirective } from '../directives/tooltip.directive';

@Component({
  selector: 'app-mcp-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalComponent,
    ButtonComponent,
    IconButtonComponent,
    TextInputComponent,
    ToggleComponent,
    SpinnerComponent,
    TooltipDirective,
    NgIconComponent,
  ],
  viewProviders: [provideIcons({ heroServerStack, heroTrash, heroChevronDown, heroPlus, heroArrowPath })],
  template: `
    <ui-modal size="lg" (closed)="closed.emit()">
      <span slot="header">{{ 'info.mcpServers' | translate }}</span>

      <!-- Add server -->
      <div class="flex gap-1.5 mb-3">
        <ui-text-input
          class="flex-1"
          [ngModel]="newMcpEndpoint()"
          (ngModelChange)="newMcpEndpoint.set($event)"
          [placeholder]="'info.mcpEndpointPlaceholder' | translate"
          [mono]="true"
        />
        <ui-button
          variant="secondary"
          size="xs"
          [disabled]="!newMcpEndpoint().trim() || addingMcp()"
          (clicked)="addMcpServer()"
        >
          @if (addingMcp()) {
            <app-spinner size="sm" />
          } @else {
            <ng-icon name="heroPlus" class="w-3 h-3" />
          }
        </ui-button>
      </div>
      @if (mcpError()) {
        <p class="text-error-text text-[10px] mb-3">{{ mcpError() }}</p>
      }

      @if (!customMcps().length) {
        <p class="text-text-muted text-center py-6 text-xs">
          {{ 'info.noMcpServers' | translate }}
        </p>
      } @else {
        <div class="flex flex-col gap-2">
          @for (mcp of customMcps(); track mcp.id) {
            <div
              class="rounded-xl border border-border-default bg-surface-overlay/40 overflow-hidden transition-colors"
              [class.opacity-60]="!mcp.active"
            >
              <div class="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  class="flex items-center gap-1.5 flex-1 min-w-0 text-left disabled:cursor-default"
                  [disabled]="!mcp.availableTools.length"
                  (click)="toggleMcpExpanded(mcp.id)"
                >
                  @if (mcp.availableTools.length) {
                    <ng-icon
                      name="heroChevronDown"
                      class="w-3 h-3 shrink-0 text-text-muted transition-transform"
                      [class.rotate-180]="!isMcpExpanded(mcp.id)"
                    />
                  }
                  <span class="flex flex-col min-w-0">
                    <span class="text-xs font-medium text-text-primary truncate">{{ mcp.name }}</span>
                    <span
                      class="text-text-muted truncate"
                      style="font-size:10px"
                      [uiTooltip]="mcp.endpoint"
                      >{{ mcp.endpoint }}</span
                    >
                  </span>
                </button>
                <ui-toggle
                  [ngModel]="mcp.active"
                  [ngModelOptions]="{ standalone: true }"
                  (checkedChange)="setMcpActive(mcp, $event)"
                />
                <ui-icon-button
                  size="sm"
                  [title]="'info.mcpRefresh' | translate"
                  [disabled]="refreshingId() === mcp.id"
                  (clicked)="refreshMcpServer(mcp)"
                >
                  @if (refreshingId() === mcp.id) {
                    <app-spinner size="sm" />
                  } @else {
                    <ng-icon name="heroArrowPath" class="w-3 h-3" />
                  }
                </ui-icon-button>
                <ui-icon-button
                  size="sm"
                  [title]="'info.mcpRemove' | translate"
                  (clicked)="removeMcpServer(mcp)"
                >
                  <ng-icon name="heroTrash" class="w-3 h-3" />
                </ui-icon-button>
              </div>

              @if (isMcpExpanded(mcp.id) && mcp.availableTools.length) {
                <div class="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-border-subtle">
                  @for (tool of mcp.availableTools; track tool) {
                    <button
                      type="button"
                      class="flex items-center gap-1 pl-2 pr-2.5 py-1 rounded-lg border text-[10px] font-mono transition-colors mt-1.5"
                      [class]="
                        mcp.allowedTools.includes(tool)
                          ? 'border-accent/40 bg-accent-subtle text-accent'
                          : 'border-border-default text-text-muted hover:border-border-strong'
                      "
                      (click)="toggleMcpTool(mcp, tool)"
                    >
                      {{ tool }}
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </ui-modal>
  `,
})
export class McpConfigDialogComponent implements OnChanges {
  private readonly authService = inject(AuthService);

  readonly initialCustomMcps = input<CustomMcpDto[]>([], { alias: 'customMcps' });
  readonly customMcpsChange = output<CustomMcpDto[]>();
  readonly closed = output<void>();

  readonly customMcps = signal<CustomMcpDto[]>([]);
  readonly newMcpEndpoint = signal('');
  readonly addingMcp = signal(false);
  readonly mcpError = signal<string | null>(null);
  private readonly expandedMcpIds = signal<Set<string>>(new Set());
  readonly refreshingId = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialCustomMcps']) this.customMcps.set(this.initialCustomMcps());
  }

  isMcpExpanded(id: string): boolean {
    return this.expandedMcpIds().has(id);
  }

  toggleMcpExpanded(id: string): void {
    this.expandedMcpIds.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  addMcpServer(): void {
    const endpoint = this.newMcpEndpoint().trim();
    if (!endpoint) return;
    this.addingMcp.set(true);
    this.mcpError.set(null);
    this.authService.addCustomMcpServer({ endpoint }).subscribe({
      next: (mcp) => {
        this.customMcps.update((list) => [...list, mcp]);
        this.customMcpsChange.emit(this.customMcps());
        this.newMcpEndpoint.set('');
        this.addingMcp.set(false);
      },
      error: (err) => {
        this.mcpError.set(err?.error?.message ?? 'Failed to add MCP server');
        this.addingMcp.set(false);
      },
    });
  }

  removeMcpServer(mcp: CustomMcpDto): void {
    this.authService.deleteCustomMcpServer(mcp.id).subscribe({
      next: () => {
        this.customMcps.update((list) => list.filter((m) => m.id !== mcp.id));
        this.customMcpsChange.emit(this.customMcps());
      },
    });
  }

  setMcpActive(mcp: CustomMcpDto, active: boolean): void {
    this.updateMcpServer(mcp, { active });
  }

  refreshMcpServer(mcp: CustomMcpDto): void {
    this.refreshingId.set(mcp.id);
    this.authService.refreshCustomMcpServer(mcp.id).subscribe({
      next: (updated) => {
        this.customMcps.update((list) => list.map((m) => (m.id === mcp.id ? updated : m)));
        this.customMcpsChange.emit(this.customMcps());
        this.refreshingId.set(null);
      },
      error: () => this.refreshingId.set(null),
    });
  }

  toggleMcpTool(mcp: CustomMcpDto, tool: string): void {
    const allowedTools = mcp.allowedTools.includes(tool)
      ? mcp.allowedTools.filter((t) => t !== tool)
      : [...mcp.allowedTools, tool];
    this.updateMcpServer(mcp, { allowedTools });
  }

  private updateMcpServer(mcp: CustomMcpDto, patch: { active?: boolean; allowedTools?: string[] }): void {
    this.authService.updateCustomMcpServer(mcp.id, patch).subscribe({
      next: (updated) => {
        this.customMcps.update((list) => list.map((m) => (m.id === mcp.id ? updated : m)));
        this.customMcpsChange.emit(this.customMcps());
      },
    });
  }
}
