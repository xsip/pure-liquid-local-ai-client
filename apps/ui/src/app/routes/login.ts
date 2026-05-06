import { animate, style, transition, trigger } from '@angular/animations';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../client';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroExclamationTriangle, heroEyeSlash, heroEye, heroArrowRight } from '@ng-icons/heroicons/outline';
import { BlobBackgroundDirective } from '../shared/directives/blob-background.directive';

@Component({
  selector: 'app-login',
  animations: [
    trigger('pageAnim', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 })),
      ]),
    ]),
    trigger('cardAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.94) translateY(16px)' }),
        animate(
          '380ms 60ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'scale(1) translateY(0)' }),
        ),
      ]),
    ]),
    trigger('headerAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate(
          '300ms 30ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
    ]),
    trigger('errorAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-8px)' }),
        animate(
          '220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'translateX(0)' }),
        ),
      ]),
      transition(':leave', [
        animate('160ms ease-in', style({ opacity: 0, transform: 'translateX(8px)' })),
      ]),
    ]),
  ],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    NgIconComponent,
    BlobBackgroundDirective,
  ],
  viewProviders: [provideIcons({ heroExclamationTriangle, heroEyeSlash, heroEye, heroArrowRight })],
  template: `
    <div
      class="min-h-screen bg-surface-base text-text-primary flex items-center justify-center p-6 relative overflow-hidden"
      @pageAnim
    >
      <!-- Atmospheric background -->
      <div
        appBlobBackground
        class="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none"
      ></div>
      <div
        class="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style="background: radial-gradient(circle, var(--color-accent-glow) 0%, transparent 70%); filter: blur(60px); opacity: 0.35;"
      ></div>
      <div
        class="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style="background: radial-gradient(circle, var(--color-secondary-accent-subtle) 0%, transparent 70%); filter: blur(50px); opacity: 0.4;"
      ></div>

      <div class="w-full max-w-sm flex flex-col gap-8 relative animate-slide-up">
        <!-- Logo / Header -->
        <div class="flex flex-col items-center gap-4 text-center" @headerAnim>
          <div class="relative">
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center animate-float"
              style="box-shadow: 0 8px 32px var(--color-accent-glow);"
            >
              <img src="logo-cropped.png" class="w-full h-full text-white" alt="logo" />
            </div>
            <div
              class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-success-muted animate-pulse"
              style="box-shadow: 0 0 8px var(--color-success-muted);"
            ></div>
          </div>
          <div>
            <h1 class="text-2xl font-semibold text-text-primary tracking-tight">
              {{ 'login.title' | translate }}
            </h1>
            <p class="text-sm text-text-muted mt-1">{{ 'login.subtitle' | translate }}</p>
          </div>
        </div>

        <!-- Card -->
        <div class="glass-strong rounded-2xl p-6 flex flex-col gap-5 shadow-depth-xl" @cardAnim>
          @if (errorMessage()) {
            <div
              class="flex items-start gap-2.5 bg-error-bg border border-error-border rounded-xl px-4 py-3 text-xs text-error-text"
              @errorAnim
            >
              <ng-icon name="heroExclamationTriangle" class="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <label
                class="text-[10px] text-text-muted uppercase tracking-[0.15em] font-semibold"
                >{{ 'login.username' | translate }}</label
              >
              <input
                type="text"
                formControlName="username"
                autocomplete="username"
                [placeholder]="'login.usernamePlaceholder' | translate"
                class="bg-surface-base border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-accent transition-all duration-200"
                style="box-shadow: var(--shadow-inset);"
                [class.border-error-border]="isInvalid('username')"
              />
              @if (isInvalid('username')) {
                <span class="text-xs text-error-text animate-slide-up">{{
                  'login.usernameRequired' | translate
                }}</span>
              }
            </div>

            <div class="flex flex-col gap-2">
              <label
                class="text-[10px] text-text-muted uppercase tracking-[0.15em] font-semibold"
                >{{ 'login.password' | translate }}</label
              >
              <div class="relative">
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="w-full bg-surface-base border border-border-default rounded-xl px-4 py-3 pr-12 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-accent transition-all duration-200"
                  style="box-shadow: var(--shadow-inset);"
                  [class.border-error-border]="isInvalid('password')"
                />
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-1"
                  tabindex="-1"
                >
                  @if (showPassword()) {
                    <ng-icon name="heroEyeSlash" class="w-4 h-4" />
                  } @else {
                    <ng-icon name="heroEye" class="w-4 h-4" />
                  }
                </button>
              </div>
              @if (isInvalid('password')) {
                <span class="text-xs text-error-text animate-slide-up">{{
                  'login.passwordRequired' | translate
                }}</span>
              }
            </div>

            <div class="animate-slide-up">
              <button
                type="submit"
                [disabled]="form.invalid || loading()"
                class="mt-1 relative overflow-hidden px-5 py-3.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                style="background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover)); box-shadow: 0 4px 20px var(--color-accent-glow);"
              >
                @if (loading()) {
                  <span
                    class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
                  ></span>
                  <span>{{ 'login.signingIn' | translate }}</span>
                } @else {
                  <span>{{ 'login.submit' | translate }}</span>
                  <ng-icon
                    name="heroArrowRight"
                    class="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  />
                }
              </button>
            </div>
          </form>
        </div>

        <div
          class="flex items-center justify-center gap-2 text-[10px] text-text-disabled animate-fade-in"
        >
          <div
            class="w-1.5 h-1.5 rounded-full bg-success-muted"
            style="box-shadow: 0 0 6px var(--color-success-muted);"
          ></div>
          <span class="tracking-wide uppercase">{{ 'login.appName' | translate }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly showPassword = signal(false);

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.form.markAllAsTouched();

    const { username, password } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.login({ user: username!, password: password! }).subscribe({
      next: (res: any) => {
        const token = res?.access_token ?? res?.token ?? res;
        if (token && typeof token === 'string') {
          localStorage.setItem('jwt_token', token);
          this.router.navigate(['/chat-openai']);
        } else {
          this.errorMessage.set('login.unexpectedResponse');
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? err?.message ?? 'login.loginFailed');
        this.loading.set(false);
      },
    });
  }
}
