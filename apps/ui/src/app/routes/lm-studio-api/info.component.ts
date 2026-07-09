import { animate, style, transition, trigger, query, stagger } from '@angular/animations';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService, LMStudioService, MeDto, ModelDto, OpenAIService } from '../../client';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SpinnerComponent } from '../../shared/components/spinner.component';
import { DarkModeToggleComponent } from '../../shared/components/ui/dark-mode-toggle.component';
import { BadgeComponent } from '../../shared/components/ui/badge.component';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowPath, heroUser, heroChartBar, heroComputerDesktop } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-info',
  animations: [
    trigger('sectionAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate(
          '260ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
    ]),
    trigger('rowAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-6px)' }),
        animate(
          '200ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateX(0)' }),
        ),
      ]),
    ]),
  ],
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    TranslateModule,
    SpinnerComponent,
    DarkModeToggleComponent,
    BadgeComponent,
    ButtonComponent,
    NgIconComponent,
  ],
  viewProviders: [provideIcons({ heroArrowPath, heroUser, heroChartBar, heroComputerDesktop })],
  template: `
    <div class="flex flex-col h-full overflow-y-auto p-4 gap-4 text-xs">
      <!-- Theme row -->
      <div class="flex items-center justify-between" @rowAnim>
        <span class="text-sm font-semibold text-text-primary">{{ 'info.theme' | translate }}</span>
        <ui-dark-mode-toggle />
      </div>

      <!-- Navigation -->
      <div class="flex items-center justify-between" @rowAnim>
        <span class="text-sm font-semibold text-text-primary">{{ 'info.client' | translate }}</span>
        <div class="flex items-center gap-1">
          <!--
          routerLink="/chat-lm-studio"
            routerLinkActive="!border-accent !text-accent !bg-accent-subtle"
            [routerLinkActiveOptions]="{ exact: false }"
          !-->
          <p
            class="px-2.5 py-1 text-[11px] rounded-lg font-medium border border-border-default text-text-secondary  cursor-not-allowed  transition-all duration-150"
          >
            {{ 'info.lmStudio' | translate }}
          </p>
          <a
            routerLink="/chat-openai"
            routerLinkActive="!border-accent !text-accent !bg-accent-subtle"
            [routerLinkActiveOptions]="{ exact: false }"
            class="px-2.5 py-1 text-[11px] rounded-lg font-medium border border-border-default text-text-secondary hover:border-accent/50 hover:text-accent hover:bg-accent-subtle active:scale-95 transition-all duration-150"
            >{{ 'info.openAI' | translate }}</a
          >
        </div>
      </div>

      <!-- Refresh -->
      <div class="flex items-center justify-between" @rowAnim>
        <span class="text-sm font-semibold text-text-primary">{{ 'info.info' | translate }}</span>
        <ui-button variant="secondary" size="xs" [disabled]="loading()" (clicked)="refresh()">
          <ng-icon
            name="heroArrowPath"
            class="w-3 h-3 transition-transform"
            [class.animate-spin]="loading()"
          />
          <span>{{ 'info.refresh' | translate }}</span>
        </ui-button>
      </div>

      <!-- User card -->
      <section
        class="rounded-2xl border border-border-default bg-surface-raised overflow-hidden shadow-depth-sm hover-lift"
        @sectionAnim
      >
        <div
          class="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle bg-surface-overlay/50"
        >
          <ng-icon name="heroUser" class="w-3.5 h-3.5 text-text-muted" />
          <span
            class="font-semibold text-text-secondary tracking-wider uppercase"
            style="font-size:10px"
            >{{ 'info.user' | translate }}</span
          >
        </div>

        @if (userLoading()) {
          <div class="px-3 py-5 flex justify-center"><app-spinner size="md" /></div>
        } @else if (userError()) {
          <p class="px-3 py-3 text-error-text text-xs">{{ 'info.failedLoadUser' | translate }}</p>
        } @else if (user()) {
          <div class="divide-y divide-border-subtle">
            <div class="flex justify-between items-center px-3 py-2.5">
              <span class="text-text-muted">{{ 'info.username' | translate }}</span>
              <span class="font-semibold text-text-primary font-mono">{{ user()!.username }}</span>
            </div>
            <div class="flex justify-between items-center px-3 py-2.5">
              <span class="text-text-muted">{{ 'info.role' | translate }}</span>
              <ui-badge [variant]="user()!.role === 'admin' ? 'warn' : 'default'">{{
                user()!.role
              }}</ui-badge>
            </div>
            <div class="flex justify-between items-center px-3 py-2.5">
              <span class="text-text-muted">{{ 'info.subscription' | translate }}</span>
              <ui-badge variant="accent">{{ user()!.subscription }}</ui-badge>
            </div>
            <div class="flex justify-between items-center px-3 py-2.5">
              <span class="text-text-muted">{{ 'info.status' | translate }}</span>
              <span class="flex items-center gap-1.5">
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  [class]="user()!.isActivated ? 'bg-success-muted' : 'bg-error-muted'"
                  [style]="
                    user()!.isActivated ? 'box-shadow: 0 0 6px var(--color-success-muted);' : ''
                  "
                ></span>
                <span [class]="user()!.isActivated ? 'text-success-text' : 'text-error-text'">
                  {{ (user()!.isActivated ? 'info.active' : 'info.inactive') | translate }}
                </span>
              </span>
            </div>
          </div>
        }
      </section>

      <!-- Token usage card -->
      <section
        class="rounded-2xl border border-border-default bg-surface-raised overflow-hidden shadow-depth-sm hover-lift"
        @sectionAnim
      >
        <div
          class="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle bg-surface-overlay/50"
        >
          <ng-icon name="heroChartBar" class="w-3.5 h-3.5 text-text-muted" />
          <span
            class="font-semibold text-text-secondary tracking-wider uppercase"
            style="font-size:10px"
            >{{ 'info.tokenUsage' | translate }}</span
          >
        </div>

        @if (userLoading()) {
          <div class="px-3 py-5 flex justify-center"><app-spinner size="md" /></div>
        } @else if (user()) {
          <div class="px-3 pt-3 pb-3 flex flex-col gap-2.5">
            <div class="flex justify-between text-[10px]">
              <span class="text-text-muted">{{ 'info.used' | translate }}</span>
              <span class="font-mono text-text-secondary font-medium"
                >{{ user()!.usedTokens | number }} / {{ user()!.tokenLimit | number }}</span
              >
            </div>
            <div class="h-2 rounded-full bg-surface-sunken overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-700"
                [style.width.%]="tokenPercent()"
                [class]="
                  tokenPercent() > 85
                    ? 'bg-error-muted'
                    : tokenPercent() > 60
                      ? 'bg-warn-muted'
                      : 'bg-accent'
                "
                [style]="
                  tokenPercent() <= 85 ? 'box-shadow: 2px 0 8px var(--color-accent-glow);' : ''
                "
              ></div>
            </div>
            <div class="flex justify-between text-[10px] text-text-muted">
              <span>{{
                'info.percentUsed' | translate: { percent: (tokenPercent() | number: '1.0-1') }
              }}</span>
              @if (user()!.tokenCountResetDate) {
                <span
                  >{{ 'info.resets' | translate }}
                  {{ user()!.tokenCountResetDate | date: 'short' }}</span
                >
              }
            </div>
          </div>
        }
      </section>

      <!-- Models card -->
      <section
        class="rounded-2xl border border-border-default bg-surface-raised overflow-hidden shadow-depth-sm hover-lift"
        @sectionAnim
      >
        <div
          class="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle bg-surface-overlay/50"
        >
          <ng-icon name="heroComputerDesktop" class="w-3.5 h-3.5 text-text-muted" />
          <span
            class="font-semibold text-text-secondary tracking-wider uppercase"
            style="font-size:10px"
            >{{ 'info.availableModels' | translate }}</span
          >
          @if (!modelsLoading() && models().length > 0) {
            <span
              class="ml-auto px-1.5 py-0.5 rounded-full bg-surface-sunken text-text-muted text-[10px] font-mono"
              >{{ models().length }}</span
            >
          }
        </div>

        @if (modelsLoading()) {
          <div class="px-3 py-5 flex justify-center"><app-spinner size="md" /></div>
        } @else if (modelsError()) {
          <p class="px-3 py-3 text-error-text text-xs">{{ 'info.failedLoadModels' | translate }}</p>
        } @else if (models().length === 0) {
          <p class="px-3 py-3 text-text-muted text-center">
            {{ 'info.noModelsLoaded' | translate }}
          </p>
        } @else {
          <div class="divide-y divide-border-subtle">
            @for (model of models(); track model.key) {
              <div class="px-3 py-2.5 flex items-center gap-2">
                <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span
                    class="font-medium text-text-primary truncate font-mono"
                    style="font-size:11px"
                    >{{ model.key }}</span
                  >
                  @if (model.publisher) {
                    <span class="text-text-muted" style="font-size:10px">{{
                      model.publisher
                    }}</span>
                  }
                </div>
                <ui-badge>{{ model.type }}</ui-badge>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
})
export class InfoComponent implements OnInit {
  readonly uiType = input.required<'OPENAI' | 'LMSTUDIO'>();
  private readonly authService = inject(AuthService);
  private readonly lmStudioService = inject(LMStudioService);
  private readonly openaiService = inject(OpenAIService);

  readonly user = signal<MeDto | null>(null);
  readonly userLoading = signal(false);
  readonly userError = signal(false);
  readonly models = signal<ModelDto[]>([]);
  readonly modelsLoading = signal(false);
  readonly modelsError = signal(false);

  readonly loading = () => this.userLoading() || this.modelsLoading();

  readonly userLoaded = output<MeDto>();

  tokenPercent(): number {
    const u = this.user();
    if (!u || !u.tokenLimit) return 0;
    return Math.min(100, (u.usedTokens / u.tokenLimit) * 100);
  }

  ngOnInit(): void {
    this.loadUser();
    this.loadModels();
  }

  refresh(): void {
    this.loadUser();
    this.loadModels();
  }

  loadUser(): void {
    this.userLoading.set(true);
    this.userError.set(false);
    this.authService.getMe().subscribe({
      next: (data) => {
        this.user.set(data);
        this.userLoading.set(false);
        this.userLoaded.emit(data);
      },
      error: () => {
        this.userError.set(true);
        this.userLoading.set(false);
      },
    });
  }

  private loadModels(): void {
    this.modelsLoading.set(true);
    this.modelsError.set(false);
    if (this.uiType() === 'LMSTUDIO') {
      this.lmStudioService.getModels().subscribe({
        next: (res) => {
          this.models.set(res.models ?? []);
          this.modelsLoading.set(false);
        },
        error: () => {
          this.modelsError.set(true);
          this.modelsLoading.set(false);
        },
      });
    } else {
      this.openaiService.getModelsOpenAi().subscribe({
        next: (res) => {
          this.models.set(
            (res ?? []).map((m) => ({ key: m.id, publisher: m.owned_by, type: 'llm' }) as ModelDto),
          );
          this.modelsLoading.set(false);
        },
        error: () => {
          this.modelsError.set(true);
          this.modelsLoading.set(false);
        },
      });
    }
  }
}
