import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPlus,
  heroPencilSquare,
  heroTrash,
  heroArrowPath,
  heroSun,
  heroMoon,
  heroArrowLeft,
  heroUserGroup,
  heroCog6Tooth,
} from '@ng-icons/heroicons/outline';
import {
  ButtonComponent,
  IconButtonComponent,
  BadgeComponent,
  ModalComponent,
  LabelComponent,
} from '../shared';
import { TextInputComponent } from '../shared/components/ui/text-input.component';
import { ToggleComponent } from '../shared/components/ui/toggle.component';
import {
  AdminService,
  AdminUser,
  TokenLimitConfig,
  AdminRole,
  AdminSubscription,
} from './admin/admin.service';

type Tab = 'users' | 'tokenLimits';

/** Only errors when non-empty and shorter than 6 chars — lets password stay optional on edit. */
function optionalMinLength(min: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;
    return value.length < min ? { minlength: { requiredLength: min, actualLength: value.length } } : null;
  };
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    NgIconComponent,
    ButtonComponent,
    IconButtonComponent,
    BadgeComponent,
    ModalComponent,
    LabelComponent,
    TextInputComponent,
    ToggleComponent,
  ],
  viewProviders: [
    provideIcons({
      heroPlus,
      heroPencilSquare,
      heroTrash,
      heroArrowPath,
      heroSun,
      heroMoon,
      heroArrowLeft,
      heroUserGroup,
      heroCog6Tooth,
    }),
  ],
  template: `
    <div class="min-h-screen bg-surface-base text-text-primary">
      <!-- ── Top bar ── -->
      <header
        class="flex items-center gap-2 border-b border-border-default px-4 py-2.5 bg-surface-raised shadow-depth-sm"
      >
        <ng-icon name="heroCog6Tooth" class="w-4 h-4 text-accent" />
        <span class="text-sm font-semibold">Admin CMS</span>

        <div class="ml-auto flex items-center gap-2">
          <button
            (click)="toggleTheme()"
            class="w-8 h-8 rounded-lg flex items-center justify-center border border-border-default bg-surface-raised hover:bg-surface-overlay text-text-secondary hover:text-text-primary transition-colors"
            title="Toggle theme"
          >
            <ng-icon name="heroSun" class="w-4 h-4 hidden dark:block" />
            <ng-icon name="heroMoon" class="w-4 h-4 block dark:hidden" />
          </button>
          <a
            routerLink="/chat-openai"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary text-xs font-medium transition-colors"
          >
            <ng-icon name="heroArrowLeft" class="w-3.5 h-3.5" />
            Back to Chat
          </a>
        </div>
      </header>

      <div class="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <!-- Tabs -->
        <div class="flex gap-2 mb-6">
          <ui-button
            variant="secondary"
            [active]="tab() === 'users'"
            (clicked)="tab.set('users')"
          >
            <ng-icon name="heroUserGroup" class="w-3.5 h-3.5" />
            Users
          </ui-button>
          <ui-button
            variant="secondary"
            [active]="tab() === 'tokenLimits'"
            (clicked)="tab.set('tokenLimits')"
          >
            <ng-icon name="heroCog6Tooth" class="w-3.5 h-3.5" />
            Token Limit Configs
          </ui-button>
        </div>

        @if (errorMessage()) {
          <div
            class="mb-4 px-4 py-2.5 rounded-lg bg-error-bg border border-error-border text-error-text text-xs"
          >
            {{ errorMessage() }}
          </div>
        }

        <!-- ── USERS TAB ── -->
        @if (tab() === 'users') {
          <section>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold">Users</h2>
              <div class="flex items-center gap-2">
                <ui-button variant="secondary" size="sm" [disabled]="usersLoading()" (clicked)="loadUsers()">
                  <ng-icon name="heroArrowPath" class="w-3.5 h-3.5" [class.animate-spin]="usersLoading()" />
                  Refresh
                </ui-button>
                <ui-button variant="primary" size="sm" (clicked)="openCreateUser()">
                  <ng-icon name="heroPlus" class="w-3.5 h-3.5" />
                  New User
                </ui-button>
              </div>
            </div>

            <div class="rounded-xl border border-border-default overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-surface-overlay text-xs text-text-muted uppercase tracking-wider">
                    <th class="text-left px-4 py-3 font-semibold">Username</th>
                    <th class="text-left px-4 py-3 font-semibold">Role</th>
                    <th class="text-left px-4 py-3 font-semibold">Subscription</th>
                    <th class="text-left px-4 py-3 font-semibold">Status</th>
                    <th class="text-left px-4 py-3 font-semibold">Token Usage</th>
                    <th class="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (u of users(); track u._id; let odd = $odd) {
                    <tr [class]="odd ? 'bg-surface-raised' : 'bg-surface-base'">
                      <td class="px-4 py-2.5 font-mono text-xs text-text-primary">{{ u.username }}</td>
                      <td class="px-4 py-2.5">
                        <ui-badge [variant]="u.role === 'admin' ? 'warn' : 'default'">{{ u.role }}</ui-badge>
                      </td>
                      <td class="px-4 py-2.5">
                        <ui-badge variant="accent">{{ u.subscription }}</ui-badge>
                      </td>
                      <td class="px-4 py-2.5">
                        <ui-badge [variant]="u.isActivated ? 'success' : 'danger'">{{
                          u.isActivated ? 'active' : 'inactive'
                        }}</ui-badge>
                      </td>
                      <td class="px-4 py-2.5 text-xs text-text-muted font-mono">{{ u.usedTokens | number }}</td>
                      <td class="px-4 py-2.5">
                        <div class="flex items-center justify-end gap-1">
                          <ui-icon-button size="sm" title="Reset token usage" (clicked)="resetTokens(u)">
                            <ng-icon name="heroArrowPath" class="w-3.5 h-3.5" />
                          </ui-icon-button>
                          <ui-icon-button size="sm" title="Edit" (clicked)="openEditUser(u)">
                            <ng-icon name="heroPencilSquare" class="w-3.5 h-3.5" />
                          </ui-icon-button>
                          <ui-icon-button size="sm" title="Delete" (clicked)="confirmDeleteUser(u)">
                            <ng-icon name="heroTrash" class="w-3.5 h-3.5 text-error-text" />
                          </ui-icon-button>
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6" class="px-4 py-8 text-center text-text-muted text-xs">
                        @if (usersLoading()) { Loading users… } @else { No users yet. }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- ── TOKEN LIMIT CONFIGS TAB ── -->
        @if (tab() === 'tokenLimits') {
          <section>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold">Token Limit Configs</h2>
              <div class="flex items-center gap-2">
                <ui-button variant="secondary" size="sm" [disabled]="configsLoading()" (clicked)="loadConfigs()">
                  <ng-icon name="heroArrowPath" class="w-3.5 h-3.5" [class.animate-spin]="configsLoading()" />
                  Refresh
                </ui-button>
                <ui-button variant="primary" size="sm" (clicked)="openCreateConfig()">
                  <ng-icon name="heroPlus" class="w-3.5 h-3.5" />
                  New Config
                </ui-button>
              </div>
            </div>

            <div class="rounded-xl border border-border-default overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-surface-overlay text-xs text-text-muted uppercase tracking-wider">
                    <th class="text-left px-4 py-3 font-semibold">Subscription</th>
                    <th class="text-left px-4 py-3 font-semibold">Tokens / Interval</th>
                    <th class="text-left px-4 py-3 font-semibold">Minutes Till Reset</th>
                    <th class="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of configs(); track c._id; let odd = $odd) {
                    <tr [class]="odd ? 'bg-surface-raised' : 'bg-surface-base'">
                      <td class="px-4 py-2.5">
                        <ui-badge variant="accent">{{ c.subscription }}</ui-badge>
                      </td>
                      <td class="px-4 py-2.5 font-mono text-xs">{{ c.tokensPerInterval | number }}</td>
                      <td class="px-4 py-2.5 font-mono text-xs">{{ c.minutesTillReset | number }}</td>
                      <td class="px-4 py-2.5">
                        <div class="flex items-center justify-end gap-1">
                          <ui-icon-button size="sm" title="Edit" (clicked)="openEditConfig(c)">
                            <ng-icon name="heroPencilSquare" class="w-3.5 h-3.5" />
                          </ui-icon-button>
                          <ui-icon-button size="sm" title="Delete" (clicked)="confirmDeleteConfig(c)">
                            <ng-icon name="heroTrash" class="w-3.5 h-3.5 text-error-text" />
                          </ui-icon-button>
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="px-4 py-8 text-center text-text-muted text-xs">
                        @if (configsLoading()) { Loading configs… } @else { No token limit configs yet. }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      </div>
    </div>

    <!-- ── USER CREATE/EDIT MODAL ── -->
    @if (showUserModal()) {
      <ui-modal (closed)="closeUserModal()">
        <span slot="header">{{ editingUser() ? 'Edit User' : 'New User' }}</span>
        <form [formGroup]="userForm" (ngSubmit)="submitUser()" class="flex flex-col gap-4 w-full">
          <div>
            <ui-label class="mb-1.5">Username</ui-label>
            <ui-text-input formControlName="username" placeholder="username" />
            @if (userForm.get('username')?.invalid && userForm.get('username')?.touched) {
              <p class="text-[10px] text-error-text mt-1">Min. 3 characters.</p>
            }
          </div>

          <div>
            <ui-label class="mb-1.5">{{ editingUser() ? 'New Password (optional)' : 'Password' }}</ui-label>
            <ui-text-input
              type="password"
              [showToggle]="true"
              formControlName="password"
              [placeholder]="editingUser() ? 'Leave blank to keep current' : 'password'"
            />
            @if (userForm.get('password')?.invalid && userForm.get('password')?.touched) {
              <p class="text-[10px] text-error-text mt-1">Min. 6 characters.</p>
            }
          </div>

          <div>
            <ui-label class="mb-1.5">Role</ui-label>
            <select
              formControlName="role"
              class="w-full bg-surface-base border border-border-default rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <div>
            <ui-label class="mb-1.5">Subscription</ui-label>
            <select
              formControlName="subscription"
              class="w-full bg-surface-base border border-border-default rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
            >
              <option value="free">free</option>
              <option value="basic">basic</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <ui-label>Activated</ui-label>
            <ui-toggle formControlName="isActivated" />
          </div>

          <div class="flex gap-2 justify-end mt-2">
            <ui-button variant="secondary" type="button" (clicked)="closeUserModal()">Cancel</ui-button>
            <ui-button variant="primary" type="submit" [disabled]="userForm.invalid || savingUser()">
              {{ editingUser() ? 'Save' : 'Create' }}
            </ui-button>
          </div>
        </form>
      </ui-modal>
    }

    <!-- ── TOKEN LIMIT CONFIG CREATE/EDIT MODAL ── -->
    @if (showConfigModal()) {
      <ui-modal (closed)="closeConfigModal()">
        <span slot="header">{{ editingConfig() ? 'Edit Token Limit Config' : 'New Token Limit Config' }}</span>
        <form [formGroup]="configForm" (ngSubmit)="submitConfig()" class="flex flex-col gap-4 w-full">
          <div>
            <ui-label class="mb-1.5">Subscription</ui-label>
            <select
              formControlName="subscription"
              [disabled]="!!editingConfig()"
              class="w-full bg-surface-base border border-border-default rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none disabled:opacity-50"
            >
              <option value="free">free</option>
              <option value="basic">basic</option>
            </select>
          </div>

          <div>
            <ui-label class="mb-1.5">Tokens per Interval</ui-label>
            <ui-text-input formControlName="tokensPerInterval" placeholder="9000" />
            @if (configForm.get('tokensPerInterval')?.invalid && configForm.get('tokensPerInterval')?.touched) {
              <p class="text-[10px] text-error-text mt-1">Must be a positive whole number.</p>
            }
          </div>

          <div>
            <ui-label class="mb-1.5">Minutes Till Reset</ui-label>
            <ui-text-input formControlName="minutesTillReset" placeholder="60" />
            @if (configForm.get('minutesTillReset')?.invalid && configForm.get('minutesTillReset')?.touched) {
              <p class="text-[10px] text-error-text mt-1">Must be a positive whole number.</p>
            }
          </div>

          <div class="flex gap-2 justify-end mt-2">
            <ui-button variant="secondary" type="button" (clicked)="closeConfigModal()">Cancel</ui-button>
            <ui-button variant="primary" type="submit" [disabled]="configForm.invalid || savingConfig()">
              {{ editingConfig() ? 'Save' : 'Create' }}
            </ui-button>
          </div>
        </form>
      </ui-modal>
    }

    <!-- ── DELETE CONFIRM MODAL ── -->
    @if (pendingDelete()) {
      <ui-modal (closed)="pendingDelete.set(null)">
        <span slot="header">Confirm Delete</span>
        <div class="flex flex-col gap-4 w-full">
          <p class="text-xs text-text-secondary">{{ pendingDelete()!.message }}</p>
          <div class="flex gap-2 justify-end">
            <ui-button variant="secondary" (clicked)="pendingDelete.set(null)">Cancel</ui-button>
            <ui-button variant="danger" (clicked)="pendingDelete()!.confirm()">Delete</ui-button>
          </div>
        </div>
      </ui-modal>
    }
  `,
})
export class AdminCms implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);

  readonly tab = signal<Tab>('users');
  readonly errorMessage = signal<string | null>(null);

  // ── Users ─────────────────────────────────────────────────────────────────
  readonly users = signal<AdminUser[]>([]);
  readonly usersLoading = signal(false);
  readonly showUserModal = signal(false);
  readonly editingUser = signal<AdminUser | null>(null);
  readonly savingUser = signal(false);

  readonly userForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [optionalMinLength(6)]],
    role: ['user' as AdminRole, Validators.required],
    subscription: ['free' as AdminSubscription, Validators.required],
    isActivated: [true],
  });

  // ── Token limit configs ──────────────────────────────────────────────────
  readonly configs = signal<TokenLimitConfig[]>([]);
  readonly configsLoading = signal(false);
  readonly showConfigModal = signal(false);
  readonly editingConfig = signal<TokenLimitConfig | null>(null);
  readonly savingConfig = signal(false);

  readonly configForm = this.fb.group({
    subscription: ['free' as AdminSubscription, Validators.required],
    tokensPerInterval: [9000, [Validators.required, Validators.min(1)]],
    minutesTillReset: [60, [Validators.required, Validators.min(1)]],
  });

  // ── Delete confirmation ──────────────────────────────────────────────────
  readonly pendingDelete = signal<{ message: string; confirm: () => void } | null>(null);

  ngOnInit(): void {
    this.loadUsers();
    this.loadConfigs();
  }

  toggleTheme(): void {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  loadUsers(): void {
    this.usersLoading.set(true);
    this.adminService.listUsers().subscribe({
      next: (list) => {
        this.users.set(list);
        this.usersLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load users.');
        this.usersLoading.set(false);
      },
    });
  }

  openCreateUser(): void {
    this.editingUser.set(null);
    this.userForm.reset({
      username: '',
      password: '',
      role: 'user',
      subscription: 'free',
      isActivated: true,
    });
    this.userForm.get('username')?.enable();
    this.showUserModal.set(true);
  }

  openEditUser(user: AdminUser): void {
    this.editingUser.set(user);
    this.userForm.reset({
      username: user.username,
      password: '',
      role: user.role,
      subscription: user.subscription,
      isActivated: user.isActivated,
    });
    this.userForm.get('username')?.disable();
    this.showUserModal.set(true);
  }

  closeUserModal(): void {
    this.showUserModal.set(false);
    this.editingUser.set(null);
  }

  submitUser(): void {
    if (this.userForm.invalid) return;
    this.savingUser.set(true);
    const raw = this.userForm.getRawValue();
    const editing = this.editingUser();

    const onDone = () => {
      this.savingUser.set(false);
      this.closeUserModal();
      this.loadUsers();
    };
    const onError = (message: string) => {
      this.savingUser.set(false);
      this.errorMessage.set(message);
    };

    if (editing) {
      this.adminService
        .updateUser(editing._id, {
          password: raw.password || undefined,
          role: raw.role!,
          subscription: raw.subscription!,
          isActivated: raw.isActivated!,
        })
        .subscribe({ next: onDone, error: () => onError('Failed to update user.') });
    } else {
      this.adminService
        .createUser({
          username: raw.username!,
          password: raw.password!,
          role: raw.role!,
          subscription: raw.subscription!,
          isActivated: raw.isActivated!,
        })
        .subscribe({ next: onDone, error: (err) => onError(err?.error?.message ?? 'Failed to create user.') });
    }
  }

  resetTokens(user: AdminUser): void {
    this.adminService.resetUserTokens(user._id).subscribe({
      next: () => this.loadUsers(),
      error: () => this.errorMessage.set('Failed to reset token usage.'),
    });
  }

  confirmDeleteUser(user: AdminUser): void {
    this.pendingDelete.set({
      message: `Delete user "${user.username}"? This cannot be undone.`,
      confirm: () => {
        this.adminService.deleteUser(user._id).subscribe({
          next: () => {
            this.pendingDelete.set(null);
            this.loadUsers();
          },
          error: (err) => {
            this.pendingDelete.set(null);
            this.errorMessage.set(err?.error?.message ?? 'Failed to delete user.');
          },
        });
      },
    });
  }

  // ── Token limit configs ──────────────────────────────────────────────────

  loadConfigs(): void {
    this.configsLoading.set(true);
    this.adminService.listTokenLimitConfigs().subscribe({
      next: (list) => {
        this.configs.set(list);
        this.configsLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load token limit configs.');
        this.configsLoading.set(false);
      },
    });
  }

  openCreateConfig(): void {
    this.editingConfig.set(null);
    this.configForm.reset({ subscription: 'free', tokensPerInterval: 9000, minutesTillReset: 60 });
    this.configForm.get('subscription')?.enable();
    this.showConfigModal.set(true);
  }

  openEditConfig(config: TokenLimitConfig): void {
    this.editingConfig.set(config);
    this.configForm.reset({
      subscription: config.subscription,
      tokensPerInterval: config.tokensPerInterval,
      minutesTillReset: config.minutesTillReset,
    });
    this.showConfigModal.set(true);
  }

  closeConfigModal(): void {
    this.showConfigModal.set(false);
    this.editingConfig.set(null);
  }

  submitConfig(): void {
    if (this.configForm.invalid) return;
    this.savingConfig.set(true);
    const raw = this.configForm.getRawValue();
    const editing = this.editingConfig();

    const onDone = () => {
      this.savingConfig.set(false);
      this.closeConfigModal();
      this.loadConfigs();
    };
    const onError = (message: string) => {
      this.savingConfig.set(false);
      this.errorMessage.set(message);
    };

    if (editing) {
      this.adminService
        .updateTokenLimitConfig(editing._id, {
          tokensPerInterval: Number(raw.tokensPerInterval),
          minutesTillReset: Number(raw.minutesTillReset),
        })
        .subscribe({ next: onDone, error: () => onError('Failed to update config.') });
    } else {
      this.adminService
        .createTokenLimitConfig({
          subscription: raw.subscription!,
          tokensPerInterval: Number(raw.tokensPerInterval),
          minutesTillReset: Number(raw.minutesTillReset),
        })
        .subscribe({
          next: onDone,
          error: (err) => onError(err?.error?.message ?? 'Failed to create config (one config per tier).'),
        });
    }
  }

  confirmDeleteConfig(config: TokenLimitConfig): void {
    this.pendingDelete.set({
      message: `Delete the token limit config for "${config.subscription}"?`,
      confirm: () => {
        this.adminService.deleteTokenLimitConfig(config._id).subscribe({
          next: () => {
            this.pendingDelete.set(null);
            this.loadConfigs();
          },
          error: (err) => {
            this.pendingDelete.set(null);
            this.errorMessage.set(err?.error?.message ?? 'Failed to delete config.');
          },
        });
      },
    });
  }
}
