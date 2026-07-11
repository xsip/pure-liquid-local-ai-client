import {
  AfterViewInit,
  Component,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroCommandLine,
  heroSun,
  heroMoon,
  heroChatBubbleOvalLeft,
  heroBolt,
  heroComputerDesktop,
  heroServer,
  heroInformationCircle,
  heroExclamationTriangle,
  heroPhoto,
  heroBars3,
  heroXMark,
  heroArrowUp,
} from '@ng-icons/heroicons/outline';
import { DarkModeToggleComponent } from '../dark-mode-toggle/dark-mode-toggle.component';
import { ParallaxDirective } from '../directives/parallax.directive';
import { SHOW_CHAT_LINK } from '../tokens';

@Component({
  selector: 'app-readme',
  standalone: true,
  imports: [RouterLink, TranslateModule, NgIconComponent, DarkModeToggleComponent, ParallaxDirective],
  viewProviders: [
    provideIcons({
      heroCommandLine,
      heroSun,
      heroMoon,
      heroChatBubbleOvalLeft,
      heroBolt,
      heroComputerDesktop,
      heroServer,
      heroInformationCircle,
      heroExclamationTriangle,
      heroPhoto,
      heroBars3,
      heroXMark,
      heroArrowUp,
    }),
  ],
  styles: [
    `
      :host {
        display: block;
      }

      section[id] {
        scroll-margin-top: 4.5rem;
      }

      pre {
        white-space: pre;
        overflow-x: auto;
        max-width: 100%;
        word-break: normal;
        overflow-wrap: normal;
      }

      .hero-grid {
        background-image:
          linear-gradient(var(--color-border-subtle) 1px, transparent 1px),
          linear-gradient(90deg, var(--color-border-subtle) 1px, transparent 1px);
        background-size: 32px 32px;
      }

      .badge-pill {
        display: inline-flex;
        align-items: center;
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 3px 10px;
        border-radius: 9999px;
      }

      .card-hover {
        transition: transform 0.2s ease;
      }
      .card-hover:hover {
        transform: translateY(-2px);
      }

      .step-line::before {
        content: '';
        position: absolute;
        left: 19px;
        top: 40px;
        bottom: -12px;
        width: 2px;
        background: linear-gradient(to bottom, var(--color-accent), transparent);
      }

      .encrypt-flow-step {
        position: relative;
      }
      .encrypt-flow-step:not(:last-child)::after {
        content: '↓';
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        color: var(--color-accent);
        font-size: 1.1rem;
        line-height: 1;
      }

      .arch-box {
        border: 1px solid var(--color-border-default);
        border-radius: 0.75rem;
        background: var(--color-surface-raised);
      }
    `,
  ],
  template: `
    <div class="min-h-screen bg-surface-base text-text-primary">
      <!-- ── HEADER ─────────────────────────────────────────────────────────── -->
      <header
        class="sticky top-0 z-50 border-b border-border-default bg-surface-base/90 backdrop-blur-md"
      >
        <div class="max-w-6xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0"
            >
              <ng-icon name="heroCommandLine" class="w-4 h-4 text-accent" />
            </span>
            <span class="font-semibold text-sm text-text-primary truncate"
              >Liquid Local AI Client</span
            >
            <span
              class="hidden sm:inline-flex badge-pill bg-accent/10 text-accent-text border border-accent/20 ml-1"
              >docs</span
            >
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Mobile "on this page" nav toggle -->
            <button
              type="button"
              (click)="mobileNavOpen.set(true)"
              class="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-xl border border-border-default text-text-secondary hover:border-accent/50 hover:text-accent hover:bg-accent-subtle active:scale-90"
              aria-label="Open page navigation"
            >
              <ng-icon name="heroBars3" class="w-4 h-4" />
            </button>

            <!-- Theme toggle: reads .dark from <html> set by the app -->
            <ui-dark-mode-toggle />

            @if (showChatLink) {
              <a
                routerLink="/chat-openai"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition-colors whitespace-nowrap"
              >
                <ng-icon name="heroChatBubbleOvalLeft" class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Go to Chat</span>
                <span class="sm:hidden">Chat</span>
              </a>
            }
          </div>
        </div>
      </header>

      <!-- ── HERO ───────────────────────────────────────────────────────────── -->
      <section
        id="hero"
        class="hero-grid relative overflow-hidden border-b border-border-default"
      >
        <div
          class="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-reasoning-bg pointer-events-none"
        ></div>
        <div class="relative max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
          <div class="flex flex-wrap items-center gap-2 mb-6">
            <span class="badge-pill bg-accent/10 text-accent-text border border-accent/20"
              >Angular 21</span
            >
            <span
              class="badge-pill bg-reasoning-bg text-reasoning-text border border-reasoning-border"
              >NestJS 11</span
            >
            <span class="badge-pill bg-tool-bg text-tool-text border border-tool-border"
              >MongoDB</span
            >
            <span class="badge-pill bg-success-bg text-success-text border border-success-border"
              >MCP</span
            >
            <span class="badge-pill bg-warn-bg text-warn-text border border-warn-border"
              >AES Encryption</span
            >
            <span class="badge-pill bg-info-bg text-info-text border border-info-border"
              >InvokeAI</span
            >
          </div>

          <h1
            class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary mb-4 leading-tight"
          >
            Liquid Local<br />
            <span
              class="text-transparent bg-clip-text bg-gradient-to-r from-accent to-reasoning-text"
              >AI Client</span
            >
          </h1>
          <p class="text-lg sm:text-xl text-text-secondary max-w-2xl mb-8 leading-relaxed">
            A full-stack AI chat client that connects to any OpenAI-compatible local inference
            server — LM Studio, Ollama, llama.cpp, vLLM — over the standard
            <code class="text-accent">/v1/chat/completions</code> endpoint, with client-side MCP
            tool orchestration, AI image generation, image upload, and optional end-to-end AES
            message encryption.
          </p>

          <div class="flex flex-wrap gap-3">
            <a
              href="#getting-started"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors"
            >
              <ng-icon name="heroBolt" class="w-4 h-4" />
              Get Started
            </a>
            <a
              href="#architecture"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-default text-text-primary font-semibold text-sm transition-colors"
            >
              Architecture
            </a>
            <a
              href="https://github.com/xsip/liquid-local-ai-client"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-border-default text-text-primary font-semibold text-sm transition-colors"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.02 11.02 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.19 1.82 1.19 3.08 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.2.66.79.55A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
                />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </section>

      <!-- ── BODY ───────────────────────────────────────────────────────────── -->
      <div class="max-w-7xl mx-auto px-4 sm:px-8 py-12">
        <div class="flex gap-10 items-start">
          <!-- ── SIDENAV ──────────────────────────────────────────────────────── -->
          <aside
            class="hidden lg:block w-56 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2"
          >
            <p
              class="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-3 px-2"
            >
              On this page
            </p>
            <nav class="flex flex-col gap-0.5">
              @for (item of navSections; track item.id) {
                <a
                  [href]="'#' + item.id"
                  class="px-2 py-1.5 rounded-lg text-xs transition-colors border-l-2"
                  [class]="
                    activeSection() === item.id
                      ? 'border-accent text-accent bg-accent/10 font-medium'
                      : 'border-transparent text-text-muted hover:text-text-primary hover:bg-surface-overlay'
                  "
                  >{{ item.label }}</a
                >
              }
            </nav>
            <button
              type="button"
              (click)="scrollToTop()"
              class="mt-3 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-accent hover:bg-accent-subtle transition-colors border-t border-border-subtle pt-3"
            >
              <ng-icon name="heroArrowUp" class="w-3.5 h-3.5" />
              To the top
            </button>
          </aside>

          <!-- ── MOBILE SIDENAV DRAWER ────────────────────────────────────────── -->
          @if (mobileNavOpen()) {
            <div
              class="lg:hidden fixed inset-0 z-[60] bg-black/50 animate-fade-in"
              (click)="mobileNavOpen.set(false)"
            ></div>
            <aside
              class="lg:hidden fixed inset-y-0 left-0 z-[70] w-64 max-w-[80vw] bg-surface-base border-r border-border-default overflow-y-auto p-4 animate-slide-in-left"
            >
              <div class="flex items-center justify-between mb-4">
                <p class="text-[10px] text-text-muted uppercase tracking-widest font-semibold">
                  On this page
                </p>
                <button
                  type="button"
                  (click)="mobileNavOpen.set(false)"
                  class="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-border-default text-text-secondary hover:border-accent/50 hover:text-accent"
                  aria-label="Close page navigation"
                >
                  <ng-icon name="heroXMark" class="w-3.5 h-3.5" />
                </button>
              </div>
              <nav class="flex flex-col gap-0.5">
                @for (item of navSections; track item.id) {
                  <a
                    [href]="'#' + item.id"
                    (click)="mobileNavOpen.set(false)"
                    class="px-2 py-1.5 rounded-lg text-xs transition-colors border-l-2"
                    [class]="
                      activeSection() === item.id
                        ? 'border-accent text-accent bg-accent/10 font-medium'
                        : 'border-transparent text-text-muted hover:text-text-primary hover:bg-surface-overlay'
                    "
                    >{{ item.label }}</a
                  >
                }
              </nav>
              <button
                type="button"
                (click)="scrollToTop(); mobileNavOpen.set(false)"
                class="mt-3 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-accent hover:bg-accent-subtle transition-colors border-t border-border-subtle pt-3"
              >
                <ng-icon name="heroArrowUp" class="w-3.5 h-3.5" />
                To the top
              </button>
            </aside>
          }

          <!-- ── SECTIONS ─────────────────────────────────────────────────────── -->
          <div class="flex-1 min-w-0 space-y-20">
            <!-- BREAKING CHANGE BANNER -->
            <section>
              <div
                class="flex gap-3 items-start bg-warn-bg border border-warn-border rounded-xl px-5 py-4"
              >
                <ng-icon
                  name="heroExclamationTriangle"
                  class="w-5 h-5 text-warn-text flex-shrink-0 mt-0.5"
                />
                <div>
                  <p class="font-semibold text-sm text-warn-text mb-1">Breaking change</p>
                  <p class="text-xs text-warn-text leading-relaxed">
                    LM Studio's native
                    <code class="bg-surface-overlay px-1 rounded">/api/v1/chat</code>
                    API and the OpenAI-compatible
                    <code class="bg-surface-overlay px-1 rounded">/v1/responses/create</code>
                    (Responses API) endpoint have been <strong>removed</strong> — the modules,
                    routes, and UI code that supported them no longer exist in this repo. See
                    <a href="#why-completions" class="underline">Chat Completions API</a> below for
                    why and what replaced them.
                  </p>
                </div>
              </div>
            </section>

            <!-- OVERVIEW IMAGE -->
            @if (isBrowser) {
              <section>
                <div
                  class="dark:hidden block bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'chat-preview-light.png'"
                  (click)="openPreview('chat-preview-light.png')"
                  role="img"
                  aria-label="chat overview light"
                ></div>
                <div
                  class="dark:block hidden bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'chat-preview-dark.png'"
                  (click)="openPreview('chat-preview-dark.png')"
                  role="img"
                  aria-label="chat overview dark"
                ></div>
              </section>
            }

            <!-- OVERVIEW -->
            <section id="overview">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Overview</h2>
              <p class="text-text-secondary mb-6">
                This Nx monorepo hosts two applications that act as a single product: an
                authenticated proxy in front of your local inference server, and the Angular chat
                interface on top of it. Every chat session is persisted in MongoDB, token usage is
                tracked per user, and the backend runs its own <strong>MCP client</strong> that
                calls tools on-demand as the model requests them — rather than relying on the
                inference server to orchestrate tool calls itself.
              </p>
              <div class="grid sm:grid-cols-2 gap-4">
                <div
                  class="card-hover bg-surface-raised border border-border-default rounded-xl p-6"
                >
                  <div class="flex items-center gap-3 mb-3">
                    <span
                      class="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center text-accent"
                    >
                      <ng-icon name="heroComputerDesktop" class="w-5 h-5" />
                    </span>
                    <div>
                      <p class="font-semibold text-text-primary">UI</p>
                      <code class="text-xs text-accent">apps/ui</code>
                    </div>
                  </div>
                  <p class="text-sm text-text-secondary">
                    Angular 21 single-page application with real-time SSE streaming, image
                    upload/attachment, and a Markdown-rendering message view shared across chat
                    routes.
                  </p>
                </div>

                <div
                  class="card-hover bg-surface-raised border border-border-default rounded-xl p-6"
                >
                  <div class="flex items-center gap-3 mb-3">
                    <span
                      class="w-9 h-9 rounded-lg bg-reasoning-bg flex items-center justify-center text-reasoning-text"
                    >
                      <ng-icon name="heroServer" class="w-5 h-5" />
                    </span>
                    <div>
                      <p class="font-semibold text-text-primary">API</p>
                      <code class="text-xs text-reasoning-text">apps/api</code>
                    </div>
                  </div>
                  <p class="text-sm text-text-secondary">
                    NestJS 11 backend acting as an authenticated inference-server proxy, MCP client
                    <em>and</em> server, InvokeAI image-gen integration, and MongoDB persistence
                    layer with JWT auth and token rate limiting.
                  </p>
                </div>
              </div>
            </section>

            <!-- WHY CHAT COMPLETIONS -->
            <section id="why-completions">
              <h2 class="text-2xl font-bold text-text-primary mb-2">
                Chat Completions API
                <span class="text-text-muted text-base font-normal">(current default)</span>
              </h2>
              <p class="text-text-secondary mb-4">
                LM Studio disabled connecting to localhost MCP servers, which broke this project's
                original architecture: the Responses API worked by handing LM Studio a
                <code class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-tool-text"
                  >type: 'mcp'</code
                >
                tool pointing at this backend's MCP server, relying on LM Studio itself to connect,
                list tools, call them, and feed results back to the model. With per-request
                localhost MCP connections disabled, that flow no longer works — and it was never
                portable to other backends anyway, since MCP tool passthrough is a
                Responses-API-only convenience.
              </p>
              <p class="text-text-secondary mb-6">
                The fix: stop depending on the inference server for MCP orchestration entirely, and
                do it ourselves. The backend now runs its own MCP client (<code
                  class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-tool-text"
                  >apps/api/src/modules/mcp-client</code
                >) that connects directly to the MCP tool server, lists available tools, and
                translates them into plain OpenAI <strong>function-tool</strong> definitions. Chat
                requests go out over the standard Chat Completions API (<code
                  class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-tool-text"
                  >/v1/chat/completions</code
                >) with those function tools attached. When the model returns
                <code class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-tool-text"
                  >tool_calls</code
                >, the backend executes them itself via the MCP client and loops back into the model
                until it produces a final answer.
              </p>
              <div class="grid sm:grid-cols-3 gap-3">
                <div class="bg-error-bg border border-error-border rounded-lg p-4">
                  <p class="text-error-text text-xs uppercase tracking-wider font-semibold mb-1">
                    Removed
                  </p>
                  <p class="font-medium text-sm text-text-primary">/api/v1/chat</p>
                  <p class="text-text-muted text-xs mt-1">LM Studio native API</p>
                </div>
                <div class="bg-error-bg border border-error-border rounded-lg p-4">
                  <p class="text-error-text text-xs uppercase tracking-wider font-semibold mb-1">
                    Removed
                  </p>
                  <p class="font-medium text-sm text-text-primary">/v1/responses/create</p>
                  <p class="text-text-muted text-xs mt-1">OpenAI Responses API</p>
                </div>
                <div class="bg-success-bg border border-success-border rounded-lg p-4">
                  <p class="text-success-text text-xs uppercase tracking-wider font-semibold mb-1">
                    Only supported path
                  </p>
                  <p class="font-medium text-sm text-text-primary">/v1/chat/completions</p>
                  <p class="text-text-muted text-xs mt-1">
                    Works with any OpenAI-compatible backend
                  </p>
                </div>
              </div>
              <p class="text-xs text-text-muted mt-4">
                Known limitation: file attachments are text-only-friendly (images are inlined as
                vision content; other file types are referenced by ID and fetched on demand via
                <code class="text-accent">get-content-from-file-ids</code>). Reasoning-effort and
                AI-decided chat naming are still supported, matching the old Responses-API
                experience.
              </p>
            </section>

            <!-- RESILIENT BACKGROUND GENERATION -->
            <section id="resilient-generation">
              <h2 class="text-2xl font-bold text-text-primary mb-2">
                Resilient Background Generation
              </h2>
              <p class="text-text-secondary mb-6">
                A chat generation isn't tied to the HTTP connection that started it. Refreshing the
                page, closing the tab, or switching to another chat while the AI is still responding
                doesn't lose or corrupt anything — the backend keeps generating in the background,
                and the frontend reattaches to it automatically.
              </p>
              <div class="space-y-3 mb-4">
                @for (step of resilientGenerationSteps; track step.n) {
                  <div
                    class="bg-surface-raised border border-border-default rounded-xl p-4 flex gap-3 items-start"
                  >
                    <span
                      class="flex-shrink-0 w-7 h-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-xs"
                      >{{ step.n }}</span
                    >
                    <p class="text-sm text-text-secondary leading-relaxed">
                      <strong class="text-text-primary">{{ step.title }}</strong> —
                      {{ step.detail }}
                    </p>
                  </div>
                }
              </div>
              <div class="bg-surface-overlay border border-border-subtle rounded-xl p-4">
                <p class="text-xs text-text-secondary">
                  <code class="text-accent"
                    >GET /openai/completions-stream/resume?internalChatId=</code
                  >
                  replays every chunk already sent for that chat's in-flight generation, then
                  streams live ones — ending immediately with no data if nothing is actually
                  in-flight.
                </p>
              </div>
            </section>

            <!-- ARCHITECTURE -->
            <section id="architecture">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Architecture</h2>
              <p class="text-text-secondary mb-6">
                Unlike the old Responses-API flow — where LM Studio itself connected to the MCP
                server mid-inference — the NestJS backend now acts as the MCP client itself: it
                lists tools from its own MCP server, attaches them to the Chat Completions request
                as plain function tools, and executes any
                <code class="text-accent">tool_calls</code> the model returns before looping back
                into the model. The inference server never talks to MCP directly, so this works with
                any backend that supports standard OpenAI function calling.
              </p>
              <div
                class="arch-box p-4 mb-6 text-xs font-mono leading-relaxed overflow-x-auto text-text-secondary"
              >
                <pre>
Angular UI (4200) ──SSE──▶ NestJS API (8888) ──/v1/chat/completions──▶ Inference server
                                    │        ▲
                          tool_calls loop    │ generate-image-tool
                                    ▼        │
                             MCP Client ──▶ MCP Server (@rekog/mcp-nest, self)
                                    │
                                    ▼
                           InvokeAI (9090) — txt2img via REST + Socket.IO</pre
                >
              </div>
              <div class="grid sm:grid-cols-4 gap-3">
                <div
                  class="bg-surface-raised border border-border-default rounded-lg p-4 text-center"
                >
                  <p class="text-text-muted text-xs uppercase tracking-wider font-semibold mb-1">
                    Frontend
                  </p>
                  <p class="font-medium text-text-primary">Angular 21</p>
                  <p class="text-text-muted text-xs mt-1">localhost:4200</p>
                </div>
                <div class="bg-accent-subtle border border-accent/25 rounded-lg p-4 text-center">
                  <p class="text-text-muted text-xs uppercase tracking-wider font-semibold mb-1">
                    Backend + MCP
                  </p>
                  <p class="font-medium text-text-primary">NestJS 11</p>
                  <p class="text-text-muted text-xs mt-1">localhost:8888</p>
                </div>
                <div
                  class="bg-surface-raised border border-border-default rounded-lg p-4 text-center"
                >
                  <p class="text-text-muted text-xs uppercase tracking-wider font-semibold mb-1">
                    Inference Server
                  </p>
                  <p class="font-medium text-text-primary">Any OpenAI-compatible</p>
                  <p class="text-text-muted text-xs mt-1">LM Studio, Ollama, llama.cpp, vLLM</p>
                </div>
                <div
                  class="bg-surface-raised border border-border-default rounded-lg p-4 text-center"
                >
                  <p class="text-text-muted text-xs uppercase tracking-wider font-semibold mb-1">
                    Image Gen
                  </p>
                  <p class="font-medium text-text-primary">InvokeAI</p>
                  <p class="text-text-muted text-xs mt-1">localhost:9090</p>
                </div>
              </div>
            </section>

            <!-- TECH STACK -->
            <section id="tech-stack">
              <h2 class="text-2xl font-bold text-text-primary mb-6">Tech Stack</h2>
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                @for (item of techStack; track item.tech) {
                  <div
                    class="card-hover bg-surface-raised border border-border-default rounded-xl p-4 flex flex-col gap-2"
                  >
                    <span [class]="'badge-pill self-start ' + item.badgeClass">{{
                      item.layer
                    }}</span>
                    <p class="text-sm font-semibold text-text-primary">{{ item.tech }}</p>
                    <p class="text-xs text-text-muted">{{ item.version }}</p>
                  </div>
                }
              </div>
            </section>

            <!-- FEATURES -->
            <section id="features">
              <h2 class="text-2xl font-bold text-text-primary mb-6">Features</h2>
              <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (feat of features; track feat.title) {
                  <div
                    class="card-hover bg-surface-raised border border-border-default rounded-xl p-5 flex gap-4"
                  >
                    <span
                      [class]="
                        'mt-0.5 w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center ' +
                        feat.iconBg
                      "
                    >
                      <svg
                        class="w-4 h-4"
                        [class]="feat.iconColor"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          [attr.d]="feat.icon"
                        />
                      </svg>
                    </span>
                    <div>
                      <p class="font-semibold text-sm text-text-primary mb-1">{{ feat.title }}</p>
                      <p class="text-xs text-text-secondary leading-relaxed">{{ feat.desc }}</p>
                    </div>
                  </div>
                }
              </div>
            </section>

            <!-- GETTING STARTED -->
            <section id="getting-started">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Getting Started</h2>
              <p class="text-text-secondary mb-8">Up and running in a few steps.</p>
              <div class="space-y-4">
                @for (step of steps; track step.n) {
                  <div class="relative flex gap-4 sm:gap-5" [class.step-line]="!$last">
                    <div
                      class="flex-shrink-0 w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm z-10"
                    >
                      {{ step.n }}
                    </div>
                    <div
                      class="flex-1 min-w-0 bg-surface-raised border border-border-default rounded-xl p-4 sm:p-5 mb-3"
                    >
                      <p class="font-semibold text-text-primary mb-2">{{ step.title }}</p>
                      @if (step.desc) {
                        <p class="text-sm text-text-secondary mb-3">{{ step.desc }}</p>
                      }
                      @if (step.code) {
                        <div class="rounded-lg overflow-hidden border border-border-subtle">
                          <pre class="bg-surface-overlay px-4 py-3 text-xs text-accent">{{
                            step.code
                          }}</pre>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </section>

            <!-- ENV VARS -->
            <section id="environment-variables">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Environment Variables</h2>
              <p class="text-text-secondary mb-6">
                Create
                <code class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-success-text"
                  >apps/api/.env</code
                >
                with the following:
              </p>
              <div
                class="bg-surface-raised border border-border-default rounded-xl overflow-hidden"
              >
                <div
                  class="flex items-center gap-2 px-4 py-2.5 bg-surface-overlay border-b border-border-subtle"
                >
                  <span class="w-3 h-3 rounded-full bg-error-muted/70"></span>
                  <span class="w-3 h-3 rounded-full bg-warn-muted/70"></span>
                  <span class="w-3 h-3 rounded-full bg-success-muted/70"></span>
                  <span class="ml-2 text-xs text-text-muted font-mono">apps/api/.env</span>
                </div>
                <div class="overflow-x-auto">
                  <pre
                    class="px-5 py-4 text-xs leading-relaxed text-text-secondary"
                  ><span class="text-text-muted"># MongoDB connection URI</span>
<span class="text-success-text">MONGODB_URI</span>=mongodb://localhost:27017/lmStudioWrapper

<span class="text-text-muted"># OpenAI-compatible inference server (LM Studio, Ollama, llama.cpp, vLLM, ...)</span>
<span class="text-success-text">LM_STUDIO_BASE_URL</span>=http://localhost:1234
<span class="text-success-text">LM_STUDIO_API_TOKEN</span>=            <span class="text-text-muted"># optional</span>

<span class="text-text-muted"># JWT signing secret</span>
<span class="text-success-text">JWT_SECRET</span>=your-very-secret-key

<span class="text-text-muted"># Backend's own MCP client connects here — safe as localhost/LAN IP</span>
<span class="text-success-text">SELF_MCP_URL</span>=http://192.168.0.34:8888/tools/mcp

<span class="text-text-muted"># Additional external MCP servers, comma-separated (optional)</span>
<span class="text-text-muted"># MCP_SERVER_URLS</span>=http://example.com/mcp,http://another-host:9000/mcp

<span class="text-text-muted"># Public base URL of this backend — used to build asset URLs (must be browser-reachable)</span>
<span class="text-success-text">SELF_URL</span>=http://localhost:8888

<span class="text-success-text">PORT</span>=8888
<span class="text-success-text">USE_SWAGGER</span>=true       <span
                  class="text-text-muted"># enables /api Swagger UI</span></pre>
                </div>
              </div>
              <div
                class="mt-3 flex gap-2 items-start bg-info-bg border border-info-border rounded-lg px-4 py-3"
              >
                <ng-icon
                  name="heroInformationCircle"
                  class="w-4 h-4 text-info-text flex-shrink-0 mt-0.5"
                />
                <p class="text-xs text-info-text">
                  Since the backend's own <strong>McpClientService</strong> is now what calls MCP
                  tools, <strong>SELF_MCP_URL</strong> only needs to be reachable from the backend
                  process itself — it no longer needs to be reachable from LM Studio.
                  <strong>SELF_URL</strong> must be reachable from the browser, or generated asset
                  links (e.g. AI-generated images) will be broken. The InvokeAI base URL is
                  currently hard-coded to
                  <code class="bg-info-bg px-1 rounded">http://127.0.0.1:9090</code> in
                  <code class="bg-info-bg px-1 rounded">app.module.ts</code>.
                </p>
              </div>
            </section>

            <!-- MCP TOOLS -->
            <section id="mcp-tool-integration">
              <h2 class="text-2xl font-bold text-text-primary mb-2">MCP Tool Integration</h2>
              <p class="text-text-secondary mb-6">
                The NestJS backend plays <strong>both</strong> MCP roles at once: an
                <strong>MCP server</strong> (<code
                  class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-tool-text"
                  >apps/api/src/tools/api.tools.ts</code
                >, via
                <code class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-tool-text"
                  >&#64;rekog/mcp-nest</code
                >) exposing Streamable HTTP + SSE transports at
                <code class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-tool-text"
                  >/tools/mcp</code
                >, and an <strong>MCP client</strong> that connects to that same server (and any
                others configured via <code class="text-accent">MCP_SERVER_URLS</code>), lists its
                tools, and calls them on the model's behalf — forwarding the authenticated user's
                JWT and current <code class="text-accent">chatId</code> so tools have full access to
                the user's context.
              </p>
              @if (isBrowser) {
                <div
                  class="dark:hidden block mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'mcp-preview-light.png'"
                  (click)="openPreview('mcp-preview-light.png')"
                  role="img"
                  aria-label="chat overview light"
                ></div>
                <div
                  class="dark:block hidden mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'mcp-preview-dark.png'"
                  (click)="openPreview('mcp-preview-dark.png')"
                  role="img"
                  aria-label="chat overview dark"
                ></div>
              }

              <div class="space-y-3 mb-4">
                @for (tool of mcpTools; track tool.name) {
                  <div
                    class="bg-surface-raised border border-border-default rounded-xl p-5 flex flex-col sm:flex-row gap-3 items-start"
                  >
                    <code
                      class="flex-shrink-0 text-xs bg-tool-bg border border-tool-border text-tool-text px-2.5 py-1 rounded-lg font-mono"
                      >{{ tool.name }}</code
                    >
                    <p class="text-sm text-text-secondary leading-relaxed">{{ tool.desc }}</p>
                  </div>
                }
              </div>
              <div class="bg-surface-overlay border border-border-subtle rounded-xl p-4">
                <p class="text-xs text-text-secondary">
                  To add a new tool: create an
                  <code class="text-accent">&#64;Injectable()</code> class in
                  <code class="text-accent">apps/api/src/tools/</code>, decorate methods with
                  <code class="text-accent">&#64;Tool(...)</code> from
                  <code class="text-accent">&#64;rekog/mcp-nest</code>, register it as a provider in
                  <code class="text-accent">AppModule</code>, and add its name to the
                  <code class="text-accent">allowedTools</code> list in
                  <code class="text-accent">OpenAiService.chatStreamCompletions</code> so it's
                  actually offered to the model.
                </p>
              </div>
            </section>

            <!-- CUSTOM MCP SERVERS -->
            <section id="custom-mcp-servers">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Custom MCP Servers</h2>
              <p class="text-text-secondary mb-6">
                Beyond the built-in MCP server/client, each user can register their own external MCP
                servers on their account and control exactly which tools are available —
                account-wide or per chat. The account-level list, the New Chat dialog, and every
                chat's settings dialog all read/write the same data, so changes made from any one of
                them show up in the others immediately.
              </p>
              @if (isBrowser) {
                <div
                  class="dark:hidden block mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'mcp-management-dialog-light.png'"
                  (click)="openPreview('mcp-management-dialog-light.png')"
                  role="img"
                  aria-label="chat overview light"
                ></div>
                <div
                  class="dark:block hidden mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'mcp-management-dialog-dark.png'"
                  (click)="openPreview('mcp-management-dialog-dark.png')"
                  role="img"
                  aria-label="chat overview dark"
                ></div>
              }
              <div class="space-y-3 mb-4">
                @for (step of customMcpSteps; track step.n) {
                  <div
                    class="bg-surface-raised border border-border-default rounded-xl p-4 flex gap-3 items-start"
                  >
                    <span
                      class="flex-shrink-0 w-7 h-7 rounded-full bg-success-bg border border-success-border flex items-center justify-center text-success-text font-bold text-xs"
                      >{{ step.n }}</span
                    >
                    <p class="text-sm text-text-secondary leading-relaxed">
                      <strong class="text-text-primary">{{ step.title }}</strong> —
                      {{ step.detail }}
                    </p>
                  </div>
                }
              </div>
              <div class="bg-surface-overlay border border-border-subtle rounded-xl p-4">
                <p class="text-xs text-text-secondary">
                  Data model: <code class="text-accent">User.customMcps[]</code> holds
                  <code class="text-accent">{{
                    '{ id, name, endpoint, active, availableTools, allowedTools, headers? }'
                  }}</code>
                  per registered server.
                  <code class="text-accent">ChatMetadata.mcpOverrides[]</code> holds
                  <code class="text-accent">{{ '{ mcpId, active, allowedTools }' }}</code> — only
                  written when a specific chat deviates from the account default.
                </p>
              </div>
            </section>

            <!-- MCP PROGRESS REPORTING -->
            <section id="mcp-progress-reporting">
              <h2 class="text-2xl font-bold text-text-primary mb-2">
                Custom MCP Progress Reporting
              </h2>
              <p class="text-text-secondary mb-6">
                MCP's spec has a standard <code class="text-accent">notifications/progress</code>
                mechanism, but neither LM Studio nor llama.cpp forward it anywhere the browser can
                see. Since this backend is its own MCP client, there was no transport carrying a
                tool's progress back to the chat UI —
                <code class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-tool-text"
                  >apps/api/src/tools/tools-helper.service.ts</code
                >
                is a custom workaround that fixes that using the same SSE connection already
                streaming the chat response.
              </p>

              @if (isBrowser) {
                <div
                  class="dark:hidden block mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'mcp-progress-light.gif'"
                  (click)="openPreview('mcp-progress-light.gif')"
                  role="img"
                  aria-label="chat overview light"
                ></div>
                <div
                  class="dark:block hidden mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'mcp-progress-dark.gif'"
                  (click)="openPreview('mcp-progress-dark.gif')"
                  role="img"
                  aria-label="chat overview dark"
                ></div>
              }

              <div class="space-y-3 mb-4">
                @for (step of mcpProgressSteps; track step.n) {
                  <div
                    class="bg-surface-raised border border-border-default rounded-xl p-4 flex gap-3 items-start"
                  >
                    <span
                      class="flex-shrink-0 w-7 h-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-xs"
                      >{{ step.n }}</span
                    >
                    <p class="text-sm text-text-secondary leading-relaxed">
                      <strong class="text-text-primary">{{ step.title }}</strong> —
                      {{ step.detail }}
                    </p>
                  </div>
                }
              </div>
              <div
                class="flex gap-2 items-start bg-info-bg border border-info-border rounded-lg px-4 py-3"
              >
                <ng-icon
                  name="heroInformationCircle"
                  class="w-4 h-4 text-info-text flex-shrink-0 mt-0.5"
                />
                <p class="text-xs text-info-text">
                  Not part of the MCP spec's own progress-notification flow — it's a bespoke SSE
                  side-channel built specifically because this project's inference-server-agnostic
                  MCP client architecture has no other way to surface a tool's own progress updates
                  to the browser in real time.
                </p>
              </div>
            </section>

            <!-- IMAGE GENERATION -->
            <section id="image-generation">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Image Generation (InvokeAI)</h2>
              <p class="text-text-secondary mb-6">
                The <code class="text-accent">generate-image-tool</code> MCP tool lets the model
                generate images on demand during a conversation via a locally running
                <a
                  href="https://invoke-ai.github.io/InvokeAI/"
                  target="_blank"
                  rel="noopener"
                  class="text-accent underline"
                  >InvokeAI</a
                >
                instance.
              </p>

              @if (isBrowser) {
                <div
                  class="dark:hidden block mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'chat-image-generator-light.png'"
                  (click)="openPreview('chat-image-generator-light.png')"
                  role="img"
                  aria-label="chat overview light"
                ></div>
                <div
                  class="dark:block hidden mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'chat-image-generator-dark.png'"
                  (click)="openPreview('chat-image-generator-dark.png')"
                  role="img"
                  aria-label="chat overview dark"
                ></div>
              }
              <div class="space-y-3">
                @for (step of invokeSteps; track step.n) {
                  <div
                    class="bg-surface-raised border border-border-default rounded-xl p-4 flex gap-3 items-start"
                  >
                    <span
                      class="flex-shrink-0 w-7 h-7 rounded-full bg-info-bg border border-info-border flex items-center justify-center text-info-text font-bold text-xs"
                      >{{ step.n }}</span
                    >
                    <p class="text-sm text-text-secondary leading-relaxed">
                      <strong class="text-text-primary">{{ step.title }}</strong> —
                      {{ step.detail }}
                    </p>
                  </div>
                }
              </div>
            </section>

            <!-- IMAGE UPLOAD -->
            <section id="image-upload">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Image Upload</h2>
              <p class="text-text-secondary mb-6">
                Users can attach one or more images to a chat message before sending. Attached files
                are listed below the textarea with filename and size, and can be removed before
                sending. On send, each image is uploaded to
                <code class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-tool-text"
                  >POST /assets/:chatId</code
                >
                as <code class="text-accent">multipart/form-data</code>, validated for MIME type
                (max <strong>10 MB</strong>), and stored as a binary blob in the
                <code class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-tool-text"
                  >image_blobs</code
                >
                MongoDB collection, then forwarded to the model as vision content.
              </p>

              <div class="grid sm:grid-cols-2 gap-4">
                <div class="bg-surface-raised border border-border-default rounded-xl p-5">
                  <div class="flex items-center gap-2 mb-3">
                    <span
                      class="w-7 h-7 rounded-lg bg-tool-bg flex items-center justify-center text-tool-text"
                    >
                      <ng-icon name="heroPhoto" class="w-4 h-4" />
                    </span>
                    <p class="font-semibold text-sm text-text-primary">Supported formats</p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    @for (fmt of imageFormats; track fmt) {
                      <span class="badge-pill bg-tool-bg text-tool-text border border-tool-border"
                        >{{ fmt }}</span
                      >
                    }
                  </div>
                </div>
                <div class="bg-surface-raised border border-border-default rounded-xl p-5">
                  <p class="font-semibold text-sm text-text-primary mb-2">Retrieval routes</p>
                  <p class="text-xs text-text-secondary leading-relaxed mb-1">
                    <code class="text-accent">GET /assets/:chatId/:filename</code> — authenticated,
                    owner or shared-chat access
                  </p>
                  <p class="text-xs text-text-secondary leading-relaxed">
                    <code class="text-accent">GET /assets/filequery/:filename?chatId=</code> —
                    authenticated, used for AI-generated image references
                  </p>
                </div>
              </div>
            </section>

            <!-- VOICE INPUT -->
            <section id="voice-input">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Voice Input</h2>
              <p class="text-text-secondary mb-6">
                A mode toggle next to the chat input swaps the whole composer between typing and
                recording. By default, no separate speech-to-text step happens in this codebase —
                the inference server itself (llama.cpp, etc.) handles transcription/understanding
                via its own audio input support. A text message is optional whenever a recording is
                attached — you can send audio-only. For models without audio support, see
                <a href="#voice-transcription" class="text-accent underline">Voice Transcription</a>
                below.
              </p>
              @if (isBrowser) {
                <div
                  class="dark:hidden block mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'chat-voice-preview-light.png'"
                  (click)="openPreview('chat-voice-preview-light.png')"
                  role="img"
                  aria-label="chat overview light"
                ></div>
                <div
                  class="dark:block hidden mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'chat-voice-preview-dark.png'"
                  (click)="openPreview('chat-voice-preview-dark.png')"
                  role="img"
                  aria-label="chat overview dark"
                ></div>
              }
              <div class="space-y-3">
                @for (step of voiceInputSteps; track step.n) {
                  <div
                    class="bg-surface-raised border border-border-default rounded-xl p-4 flex gap-3 items-start"
                  >
                    <span
                      class="flex-shrink-0 w-7 h-7 rounded-full bg-tool-bg border border-tool-border flex items-center justify-center text-tool-text font-bold text-xs"
                      >{{ step.n }}</span
                    >
                    <p class="text-sm text-text-secondary leading-relaxed">
                      <strong class="text-text-primary">{{ step.title }}</strong> —
                      {{ step.detail }}
                    </p>
                  </div>
                }
              </div>
              <div
                class="mt-4 flex gap-2 items-start bg-info-bg border border-info-border rounded-lg px-4 py-3"
              >
                <ng-icon
                  name="heroInformationCircle"
                  class="w-4 h-4 text-info-text flex-shrink-0 mt-0.5"
                />
                <p class="text-xs text-info-text">
                  Requires a model with audio understanding support (e.g. an audio-capable llama.cpp
                  build/model) unless
                  <a href="#voice-transcription" class="underline">Voice Transcription</a> is
                  enabled for the chat. If the loaded model can't process
                  <code class="bg-info-bg px-1 rounded">input_audio</code> and transcription is off,
                  expect it to ignore or error on the audio content.
                </p>
              </div>
            </section>

            <!-- VOICE TRANSCRIPTION -->
            <section id="voice-transcription">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Voice Transcription</h2>
              <p class="text-text-secondary mb-6">
                Per-chat opt-in (<code class="text-accent">ChatMetadata.transcribeAudio</code>) that
                turns a recorded voice message into an ordinary typed message <em>before</em> the
                model ever sees audio — useful for models without audio support, or simply to get
                more reliable tool-calling/reasoning out of a model that technically accepts
                <code class="text-accent">input_audio</code> but doesn't handle it as well as text.
              </p>
              @if (isBrowser) {
                <div
                  class="dark:hidden block mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'audio-transcribe-light.gif'"
                  (click)="openPreview('audio-transcribe-light.gif')"
                  role="img"
                  aria-label="chat overview light"
                ></div>
                <div
                  class="dark:block hidden mb-2 bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'audio-transcribe-dark.gif'"
                  (click)="openPreview('audio-transcribe-dark.gif')"
                  role="img"
                  aria-label="chat overview dark"
                ></div>
              }
              <div class="space-y-3 mb-4">
                @for (step of voiceTranscriptionSteps; track step.n) {
                  <div
                    class="bg-surface-raised border border-border-default rounded-xl p-4 flex gap-3 items-start"
                  >
                    <span
                      class="flex-shrink-0 w-7 h-7 rounded-full bg-success-bg border border-success-border flex items-center justify-center text-success-text font-bold text-xs"
                      >{{ step.n }}</span
                    >
                    <p class="text-sm text-text-secondary leading-relaxed">
                      <strong class="text-text-primary">{{ step.title }}</strong> —
                      {{ step.detail }}
                    </p>
                  </div>
                }
              </div>
              <p class="text-text-secondary mb-4">
                Any <code class="text-accent">input_audio</code> part that isn't
                <code class="text-accent">userRecorded</code> (or transcription is off for the chat)
                still falls back to the plain "listen to this audio" system prompt from
                <a href="#voice-input" class="text-accent underline">Voice Input</a> — nothing about
                that path changes.
              </p>
              <div
                class="flex gap-2 items-start bg-info-bg border border-info-border rounded-lg px-4 py-3"
              >
                <ng-icon
                  name="heroInformationCircle"
                  class="w-4 h-4 text-info-text flex-shrink-0 mt-0.5"
                />
                <p class="text-xs text-info-text">
                  Why a separate call instead of one combined prompt: an earlier version tried to
                  get a single request to both transcribe <em>and</em> answer via a JSON-envelope
                  system prompt, but small local models frequently either broke tool-calling, leaked
                  the JSON scaffold into the chat, or answered the audio's request directly instead
                  of transcribing it. Splitting transcription into its own untracked, audio-only
                  call sidesteps all three failure modes.
                </p>
              </div>
            </section>

            <!-- ENCRYPTION -->
            <section id="message-encryption">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Message Encryption</h2>
              <p class="text-text-secondary mb-8">
                Per-chat AES-256 encryption can be opted into when creating a new chat session. Only
                ciphertext ever reaches the inference server's own message store/logs — plaintext
                never leaves the NestJS trust boundary.
              </p>
              <div class="grid sm:grid-cols-5 gap-6 sm:gap-2 mb-8">
                @for (step of encryptionFlow; track step.n) {
                  <div class="encrypt-flow-step flex sm:flex-col items-center gap-3 sm:gap-2">
                    <div
                      [class]="
                        'w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm border ' +
                        step.circleClass
                      "
                    >
                      {{ step.n }}
                    </div>
                    <div class="flex-1 sm:flex-none sm:text-center">
                      <p class="font-semibold text-xs text-text-primary">{{ step.title }}</p>
                      <p class="text-xs text-text-muted mt-0.5 leading-relaxed">
                        {{ step.detail }}
                      </p>
                    </div>
                  </div>
                }
              </div>

              <h3 class="text-base font-semibold text-text-primary mb-3">
                Key Storage &amp; Security Boundaries
              </h3>
              <div class="overflow-x-auto rounded-xl border border-border-default">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="bg-surface-overlay text-xs text-text-muted uppercase tracking-wider">
                      <th class="text-left px-4 py-3 font-semibold">What</th>
                      <th class="text-left px-4 py-3 font-semibold">Where</th>
                      <th class="text-left px-4 py-3 font-semibold">Plaintext?</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of securityBoundaries; track row.what) {
                      <tr [class]="$odd ? 'bg-surface-raised' : 'bg-surface-base'">
                        <td class="px-4 py-3 text-text-primary font-mono text-xs">
                          {{ row.what }}
                        </td>
                        <td class="px-4 py-3 text-text-secondary text-xs">{{ row.where }}</td>
                        <td class="px-4 py-3">
                          @if (row.plaintext) {
                            <span
                              class="badge-pill bg-success-bg text-success-text border border-success-border"
                              >&#10003; Yes</span
                            >
                          }
                          @if (!row.plaintext) {
                            <span
                              class="badge-pill bg-error-bg text-error-text border border-error-border"
                              >&#10007; No</span
                            >
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div
                class="mt-4 flex gap-2 items-start bg-warn-bg border border-warn-border rounded-lg px-4 py-3"
              >
                <ng-icon
                  name="heroExclamationTriangle"
                  class="w-4 h-4 text-warn-text flex-shrink-0 mt-0.5"
                />
                <p class="text-xs text-warn-text">
                  The <strong>cryptoKey</strong> lives in MongoDB — your NestJS API and database are
                  the security boundary. Use HTTPS and restrict DB access in any non-local
                  deployment.
                </p>
              </div>
            </section>

            <!-- AUTH -->
            <section id="authentication">
              <h2 class="text-2xl font-bold text-text-primary mb-6">
                Authentication &amp; Authorization
              </h2>
              <div class="grid sm:grid-cols-2 gap-4">
                @for (item of authItems; track item.title) {
                  <div
                    class="bg-surface-raised border border-border-default rounded-xl p-5 flex gap-3"
                  >
                    <span
                      [class]="
                        'mt-0.5 w-7 h-7 flex-shrink-0 rounded-md flex items-center justify-center ' +
                        item.iconBg
                      "
                    >
                      <svg
                        class="w-3.5 h-3.5"
                        [class]="item.iconColor"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          [attr.d]="item.icon"
                        />
                      </svg>
                    </span>
                    <div>
                      <p class="font-semibold text-sm text-text-primary mb-1">{{ item.title }}</p>
                      <p class="text-xs text-text-secondary leading-relaxed">{{ item.desc }}</p>
                    </div>
                  </div>
                }
              </div>
            </section>

            <!-- TOKEN LIMITING -->
            <section id="token-usage">
              <h2 class="text-2xl font-bold text-text-primary mb-2">
                Token Usage &amp; Rate Limiting
              </h2>
              <p class="text-text-secondary mb-6">
                Token consumption is tracked per user and enforced against subscription-tier limits
                configured in the
                <code class="text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-reasoning-text"
                  >token_limit_configs</code
                >
                MongoDB collection.
              </p>
              <div class="grid sm:grid-cols-3 gap-4 mb-5">
                @for (tier of tokenTiers; track tier.label) {
                  <div [class]="'card-hover rounded-xl p-5 border ' + tier.cardClass">
                    <p
                      [class]="'text-xs font-bold uppercase tracking-wider mb-1 ' + tier.labelClass"
                    >
                      {{ tier.label }}
                    </p>
                    <p class="text-2xl font-bold text-text-primary mb-1">{{ tier.tokens }}</p>
                    <p class="text-xs text-text-muted">tokens / interval</p>
                  </div>
                }
              </div>
              <p class="text-xs text-text-muted">
                After each completed inference,
                <code class="text-reasoning-text">TokenLimitService.updateUsedTokens()</code>
                increments the user's <code class="text-reasoning-text">usedTokens</code> counter.
                If the limit is reached, an
                <code class="text-reasoning-text">api.info</code>
                SSE event is emitted with the reset timestamp. Limits reset automatically when
                <code class="text-reasoning-text">tokenCountResetDate</code> elapses. Token limits
                are managed exclusively through the
                <a href="#admin-cms" class="text-accent underline">Admin CMS</a> — the
                <code class="text-reasoning-text">TokenLimitModule</code> controller is gated behind
                <code class="text-reasoning-text">&#64;Roles(Role.Admin)</code>.
              </p>
            </section>

            <!-- ADMIN CMS -->
            <section id="admin-cms">
              <h2 class="text-2xl font-bold text-text-primary mb-2">Admin CMS</h2>
              <p class="text-text-secondary mb-6">
                A role-gated <code class="text-accent">/admin</code> route (Angular reactive forms
                throughout — no <code class="text-accent">ngModel</code>) for managing users and
                token-limit configs without touching MongoDB by hand. Only visible/reachable for
                users with <code class="text-accent">role: 'admin'</code> — the link appears in the
                account info panel only for admins, and is enforced twice: an Angular
                <code class="text-accent">adminGuard</code> route guard, and
                <code class="text-accent">&#64;Roles(Role.Admin)</code> on every backend endpoint.
              </p>

              <h3 class="text-base font-semibold text-text-primary mb-2">User Management</h3>
              @if (isBrowser) {
                <div
                  class="dark:hidden block mb-2 rounded-xl border border-border-default bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'admin-users-preview-light.png'"
                  (click)="openPreview('admin-users-preview-light.png')"
                  role="img"
                  aria-label="admin CMS user management light"
                ></div>
                <div
                  class="dark:block hidden mb-6 rounded-xl border border-border-default bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'admin-users-preview-dark.png'"
                  (click)="openPreview('admin-users-preview-dark.png')"
                  role="img"
                  aria-label="admin CMS user management dark"
                ></div>
              }
              <p class="text-text-secondary mb-6">
                List every user with role, subscription, activation status, and current token usage.
                Create a user directly (bypassing the normal registration/activation-email flow),
                edit an existing user's role, subscription, activation status, or password, reset
                their token-usage counter on demand, or delete them (an admin cannot delete their
                own account, to avoid accidental lockout).
              </p>

              <h3 class="text-base font-semibold text-text-primary mb-2">
                Token Limit Config Management
              </h3>
              @if (isBrowser) {
                <div
                  class="dark:hidden block mb-2 rounded-xl border border-border-default bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'admin-tokens-preview-light.png'"
                  (click)="openPreview('admin-tokens-preview-light.png')"
                  role="img"
                  aria-label="admin CMS token limit config management light"
                ></div>
                <div
                  class="dark:block hidden mb-6 rounded-xl border border-border-default bg-contain bg-center bg-no-repeat bg-surface-overlay cursor-zoom-in h-56 sm:h-72 lg:h-96"
                  [uiParallax]="'admin-tokens-preview-dark.png'"
                  (click)="openPreview('admin-tokens-preview-dark.png')"
                  role="img"
                  aria-label="admin CMS token limit config management dark"
                ></div>
              }
              <p class="text-text-secondary mb-6">
                List, create, edit, and delete
                <code class="text-accent">token_limit_configs</code> documents.
                <strong
                  >Creating a config with a brand-new tier name is how a new subscription type is
                  defined</strong
                >
                — there's no separate "add subscription type" step. The tier-name field is free text
                when creating a config (validated against
                <code class="text-accent">^[a-z0-9_-]&#123;2,32&#125;$</code>), and locked once a
                config exists (one config per tier, enforced by a unique index). The "assign
                subscription" dropdown in the user-edit dialog is populated from
                <code class="text-accent">GET /admin/users/subscription-types</code>, which unions
                the built-in defaults (<code class="text-accent">free</code>,
                <code class="text-accent">basic</code>), every tier with a config, and any tier
                already assigned to a user — so a user's tier stays selectable even if its config
                was later deleted.
              </p>

              <div class="overflow-x-auto rounded-xl border border-border-default">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="bg-surface-overlay text-xs text-text-muted uppercase tracking-wider">
                      <th class="text-left px-4 py-3 font-semibold w-20">Method</th>
                      <th class="text-left px-4 py-3 font-semibold">Path</th>
                      <th class="text-left px-4 py-3 font-semibold hidden sm:table-cell">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (route of adminApiRoutes; track route.method + route.path) {
                      <tr [class]="$odd ? 'bg-surface-raised' : 'bg-surface-base'">
                        <td class="px-4 py-2.5">
                          <span [class]="'badge-pill ' + route.methodClass">{{
                            route.method
                          }}</span>
                        </td>
                        <td class="px-4 py-2.5 font-mono text-xs text-text-secondary">
                          {{ route.path }}
                        </td>
                        <td class="px-4 py-2.5 text-xs text-text-muted hidden sm:table-cell">
                          {{ route.desc }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <p class="mt-3 text-xs text-text-muted">
                All admin routes require both a valid JWT and
                <code class="text-accent">role: 'admin'</code>.
              </p>
            </section>

            <!-- API TABLE -->
            <section id="api-overview">
              <h2 class="text-2xl font-bold text-text-primary mb-6">API Overview</h2>
              <div class="overflow-x-auto rounded-xl border border-border-default">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="bg-surface-overlay text-xs text-text-muted uppercase tracking-wider">
                      <th class="text-left px-4 py-3 font-semibold w-20">Method</th>
                      <th class="text-left px-4 py-3 font-semibold">Path</th>
                      <th class="text-left px-4 py-3 font-semibold hidden sm:table-cell">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (route of apiRoutes; track route.method + route.path) {
                      <tr [class]="$odd ? 'bg-surface-raised' : 'bg-surface-base'">
                        <td class="px-4 py-2.5">
                          <span [class]="'badge-pill ' + route.methodClass">{{
                            route.method
                          }}</span>
                        </td>
                        <td class="px-4 py-2.5 font-mono text-xs text-text-secondary">
                          {{ route.path }}
                        </td>
                        <td class="px-4 py-2.5 text-xs text-text-muted hidden sm:table-cell">
                          {{ route.desc }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <p class="mt-3 text-xs text-text-muted">
                Full interactive docs at
                <code class="text-accent">http://localhost:8888/api</code> when
                <code class="text-accent">USE_SWAGGER=true</code>.
              </p>
            </section>
          </div>
        </div>

        <!-- FOOTER -->
        <footer
          class="border-t border-border-default pt-8 pb-4 mt-20 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-text-muted"
        >
          <p>Liquid Local AI Client &mdash; MIT License</p>
          <div class="flex gap-4">
            <span>Angular <strong class="text-text-secondary">21</strong></span>
            <span>NestJS <strong class="text-text-secondary">11</strong></span>
            <span>Mongoose <strong class="text-text-secondary">9</strong></span>
            <span>&#64;rekog/mcp-nest <strong class="text-text-secondary">1.9</strong></span>
          </div>
        </footer>
      </div>

      <!-- ── IMAGE PREVIEW LIGHTBOX ─────────────────────────────────────────── -->
      @if (previewImage()) {
        <div
          class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm animate-fade-in"
          (click)="closePreview()"
        >
          <button
            type="button"
            (click)="closePreview()"
            class="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-white/20 text-white/80 hover:text-white hover:bg-white/10 active:scale-90"
            aria-label="Close image preview"
          >
            <ng-icon name="heroXMark" class="w-5 h-5" />
          </button>
          <img
            [src]="previewImage()"
            alt="Preview"
            (click)="$event.stopPropagation()"
            class="max-w-full max-h-full rounded-xl shadow-2xl animate-pop-in"
          />
        </div>
      }
    </div>
  `,
})
export class ReadmeComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  /** False during SSR — keeps the initial server-rendered payload free of
   *  the (large, non-critical-for-SEO) screenshot/gif images. */
  protected readonly isBrowser = isPlatformBrowser(this.platformId);

  /** Only the `ui` app actually has a /chat-openai route to link to. */
  protected readonly showChatLink = inject(SHOW_CHAT_LINK);

  constructor() {
    const description =
      "A full-stack AI chat client that connects to any OpenAI-compatible local inference " +
      'server (LM Studio, Ollama, llama.cpp, vLLM, ...) via the standard /v1/chat/completions ' +
      'endpoint. Built with Angular, NestJS, and MongoDB, with first-class MCP (Model Context ' +
      'Protocol) tool support, AI image generation via InvokeAI, image upload into chat, voice ' +
      'message recording, and optional end-to-end AES message encryption.';

    this.title.setTitle('Liquid Local AI Client — Full-stack AI Chat Client for Local LLMs');
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({
      name: 'keywords',
      content:
        'LM Studio, Ollama, llama.cpp, vLLM, MCP, Model Context Protocol, local AI chat, ' +
        'self-hosted LLM client, Angular, NestJS, InvokeAI',
    });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({
      property: 'og:title',
      content: 'Liquid Local AI Client',
    });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: '/chat-preview-dark.png' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: 'Liquid Local AI Client' });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: '/chat-preview-dark.png' });
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  scrollToTop(): void {
    document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  readonly previewImage = signal<string | null>(null);

  openPreview(src: string): void {
    this.previewImage.set(src);
  }

  closePreview(): void {
    this.previewImage.set(null);
  }

  readonly navSections = [
    { id: 'overview', label: 'Overview' },
    { id: 'why-completions', label: 'Chat Completions API' },
    { id: 'resilient-generation', label: 'Resilient Background Generation' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'tech-stack', label: 'Tech Stack' },
    { id: 'features', label: 'Features' },
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'environment-variables', label: 'Environment Variables' },
    { id: 'mcp-tool-integration', label: 'MCP Tool Integration' },
    { id: 'custom-mcp-servers', label: 'Custom MCP Servers' },
    { id: 'mcp-progress-reporting', label: 'MCP Progress Reporting' },
    { id: 'image-generation', label: 'Image Generation' },
    { id: 'image-upload', label: 'Image Upload' },
    { id: 'voice-input', label: 'Voice Input' },
    { id: 'voice-transcription', label: 'Voice Transcription' },
    { id: 'message-encryption', label: 'Message Encryption' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'token-usage', label: 'Token Usage' },
    { id: 'admin-cms', label: 'Admin CMS' },
    { id: 'api-overview', label: 'API Overview' },
  ];

  readonly activeSection = signal<string>('overview');
  readonly mobileNavOpen = signal(false);
  private sectionObserver?: IntersectionObserver;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    const sections = this.navSections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);

    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) this.activeSection.set(visible[0].target.id);
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: 0 },
    );

    sections.forEach((el) => this.sectionObserver!.observe(el));
  }

  ngOnDestroy(): void {
    this.sectionObserver?.disconnect();
  }

  techStack = [
    {
      layer: 'Frontend',
      tech: 'Angular 21',
      version: '^21.2.0',
      badgeClass: 'bg-accent/10 text-accent-text border border-accent/20',
    },
    {
      layer: 'Backend',
      tech: 'NestJS 11',
      version: '^11.0.1',
      badgeClass: 'bg-reasoning-bg text-reasoning-text border border-reasoning-border',
    },
    {
      layer: 'Language',
      tech: 'TypeScript 5.9',
      version: '~5.9.2',
      badgeClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      layer: 'Database',
      tech: 'MongoDB / Mongoose',
      version: '^9.4.1',
      badgeClass: 'bg-success-bg text-success-text border border-success-border',
    },
    {
      layer: 'MCP',
      tech: '@rekog/mcp-nest',
      version: '^1.9.9',
      badgeClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      layer: 'Image Gen',
      tech: 'InvokeAI (REST + Socket.IO)',
      version: 'local',
      badgeClass: 'bg-info-bg text-info-text border border-info-border',
    },
    {
      layer: 'File Upload',
      tech: '@nestjs/platform-express (Multer)',
      version: 'memory storage',
      badgeClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      layer: 'Encryption',
      tech: 'CryptoJS AES',
      version: '^4.2.0',
      badgeClass: 'bg-warn-bg text-warn-text border border-warn-border',
    },
    {
      layer: 'Styling',
      tech: 'TailwindCSS 4',
      version: '^4.2.2',
      badgeClass: 'bg-info-bg text-info-text border border-info-border',
    },
    {
      layer: 'OpenAI SDK',
      tech: 'openai',
      version: '^6.34.0',
      badgeClass: 'bg-error-bg text-error-text border border-error-border',
    },
    {
      layer: 'Auth',
      tech: 'JWT + bcrypt',
      version: '^6.0.0',
      badgeClass: 'bg-warn-bg text-warn-text border border-warn-border',
    },
    {
      layer: 'Monorepo',
      tech: 'Nx',
      version: '22.6.5',
      badgeClass: 'bg-reasoning-bg text-reasoning-text border border-reasoning-border',
    },
  ];

  features = [
    {
      title: 'OpenAI-compatible Chat Completions',
      desc: 'Talks to any backend implementing /v1/chat/completions — LM Studio, Ollama, llama.cpp, vLLM. The only supported chat path.',
      icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      iconBg: 'bg-accent/15',
      iconColor: 'text-accent',
    },
    {
      title: 'Custom MCP Servers',
      desc: 'Register your own external MCP servers per account, auto-discover their tools, toggle servers/tools on/off, refresh on demand, and opt individual chats out without changing the account default.',
      icon: 'M5 12h14M12 5l7 7-7 7',
      iconBg: 'bg-success-bg',
      iconColor: 'text-success-text',
    },
    {
      title: 'Client-side MCP orchestration',
      desc: 'The backend runs its own MCP client, translates MCP tools into OpenAI function-tool definitions, and executes tool_calls itself in a loop.',
      icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z',
      iconBg: 'bg-reasoning-bg',
      iconColor: 'text-reasoning-text',
    },
    {
      title: 'Real-time SSE Streaming',
      desc: 'Responses are streamed token-by-token to the browser, including reasoning/"thinking" deltas where the model provides them.',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      iconBg: 'bg-tool-bg',
      iconColor: 'text-tool-text',
    },
    {
      title: 'AI Image Generation',
      desc: 'The model can call generate-image-tool during inference; the backend submits a txt2img job to InvokeAI, stores the result, and returns it as a chat image.',
      icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z',
      iconBg: 'bg-info-bg',
      iconColor: 'text-info-text',
    },
    {
      title: 'Image Upload',
      desc: 'Attach one or more images before sending; they are stored in MongoDB via the Assets API and forwarded to the model as vision content.',
      icon: 'M3 16l4.586-4.586a2 2 0 012.828 0L15 16m-2-2l1.586-1.586a2 2 0 012.828 0L21 16M3 20h18a2 2 0 002-2V6a2 2 0 00-2-2H3a2 2 0 00-2 2v12a2 2 0 002 2z',
      iconBg: 'bg-tool-bg',
      iconColor: 'text-tool-text',
    },
    {
      title: 'Voice Input',
      desc: 'A dedicated mic mode swaps the editor for a recording panel — live bar visualiser, playback, re-record/remove — built on the raw Web Audio API. Sent as an input_audio content part; text is optional when audio is attached.',
      icon: 'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z',
      iconBg: 'bg-tool-bg',
      iconColor: 'text-tool-text',
    },
    {
      title: 'Voice Transcription',
      desc: 'Per-chat opt-in: recorded voice messages are transcribed via a separate, untracked LLM call and swapped for plain text before the main turn runs — tool-calling, reasoning, and token accounting all behave exactly like a typed message.',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      iconBg: 'bg-success-bg',
      iconColor: 'text-success-text',
    },
    {
      title: 'AES Message Encryption',
      desc: 'Per-chat opt-in encryption. Only ciphertext reaches the inference server; the model decrypts via MCP at inference time.',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      iconBg: 'bg-warn-bg',
      iconColor: 'text-warn-text',
    },
    {
      title: 'Persistent Chat History',
      desc: 'Every exchange is stored in MongoDB as a rolling message array, rehydrated on demand — including tool-call banners and image attachments.',
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      iconBg: 'bg-success-bg',
      iconColor: 'text-success-text',
    },
    {
      title: 'Resilient Background Generation',
      desc: 'A response keeps generating server-side even if you disconnect. Refresh mid-response or switch chats and reattach to the live stream instead of losing it.',
      icon: 'M4.5 12a7.5 7.5 0 0113.5-4.5M19.5 12a7.5 7.5 0 01-13.5 4.5M4.5 4.5v4.5h4.5M19.5 19.5V15h-4.5',
      iconBg: 'bg-accent/15',
      iconColor: 'text-accent',
    },
    {
      title: 'Subscription-Aware Token Limiting',
      desc: 'Configurable token budgets per subscription tier — not limited to free/basic, new tiers can be created on the fly — with automatic reset intervals and SSE limit notifications.',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      iconBg: 'bg-error-bg',
      iconColor: 'text-error-text',
    },
    {
      title: 'Admin CMS',
      desc: 'Role-gated /admin UI (reactive forms, no ngModel) for managing users — role, subscription, activation, password, token-usage reset — and token-limit configs, including defining brand-new subscription tiers.',
      icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z',
      iconBg: 'bg-warn-bg',
      iconColor: 'text-warn-text',
    },
    {
      title: 'JWT Authentication',
      desc: 'Login / register with bcrypt-hashed passwords. Tokens expire after 1 hour; Angular auto-redirects on expiry.',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      iconBg: 'bg-success-bg',
      iconColor: 'text-success-text',
    },
    {
      title: 'Reasoning Mode',
      desc: 'Pass reasoning effort (off / low / medium / high) to supported models via the Chat Completions endpoint.',
      icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
      iconBg: 'bg-reasoning-bg',
      iconColor: 'text-reasoning-text',
    },
    {
      title: 'Swagger UI',
      desc: 'Optional OpenAPI documentation at /api. Enabled by setting USE_SWAGGER=true in the environment.',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      iconBg: 'bg-info-bg',
      iconColor: 'text-info-text',
    },
  ];

  steps = [
    { n: '1', title: 'Install dependencies', desc: 'From the monorepo root:', code: 'npm install' },
    {
      n: '2',
      title: 'Configure environment',
      desc: 'Create apps/api/.env — see the Environment Variables section below.',
      code: null,
    },
    {
      n: '3',
      title: 'Start API & UI',
      desc: 'Run each in a separate terminal, or both at once:',
      code: `nx serve api          # → http://localhost:8888\nnx serve ui           # → http://localhost:4200\n\n# Or start both simultaneously:\nnpm start`,
    },
    {
      n: '4',
      title: 'Register a user',
      desc: 'Use Swagger UI at /api or curl:',
      code: `curl -X POST http://localhost:8888/auth/register \\\n  -H "Content-Type: application/json" \\\n  -d '{"username":"alice","password":"s3cret"}'`,
    },
  ];

  mcpProgressSteps = [
    {
      n: '1',
      title: 'A tool reports progress',
      detail:
        'any @Tool() method calls this.toolsHelperService.emitApiEvent(request, ApiEvent.MCP_PROGRESS, { progress, total, message }) while it runs (see greeting-tool in api.tools.ts for a working example).',
    },
    {
      n: '2',
      title: 'Looked up by request ID',
      detail:
        "emitApiEvent reads a requestid header off the tool's own incoming request (forwarded by McpClientService on every tool call) and uses it to find the live SSE Response via OpenAiResponseService.get(requestId) — the same registry used for Resilient Background Generation.",
    },
    {
      n: '3',
      title: 'Written onto the chat SSE stream',
      detail:
        'if a matching response is found, an api_report_mcp_progress SSE event is written straight onto it — riding the exact same connection as the chat completion chunks and response.mcp_call.* events, no separate channel.',
    },
    {
      n: '4',
      title: 'Frontend consumption',
      detail:
        "OpenAiStreamService parses api_report_mcp_progress like any other SSE event and forwards it through events$. ChatCompletionsService updates the currently-streaming tool_call bubble's progress/total/progressMessage fields, rendered live by chat-messages.component.ts.",
    },
  ];

  mcpTools = [
    {
      name: 'get-token-usage-tool',
      desc: "Returns the authenticated user's current token consumption, subscription tier, configured limit, and next reset timestamp.",
    },
    {
      name: 'get-content-from-file-ids',
      desc: 'Returns the base64 content of previously uploaded or generated files, looked up by file ID.',
    },
    {
      name: 'generate-file-from-content-tool',
      desc: 'Generates a downloadable file from provided content and stores it as an asset.',
    },
    {
      name: 'generate-zip-from-file-ids',
      desc: 'Bundles multiple previously generated or uploaded files into a downloadable ZIP archive.',
    },
    {
      name: 'get-image-tool',
      desc: 'Fetches an image from a URL and stores it as an asset.',
    },
    {
      name: 'decrypt-message-tool',
      desc: "Receives the full, unmodified ciphertext of the user's message, looks up the per-chat cryptoKey from chat_metadata, and returns the AES-decrypted plaintext to the model.",
    },
    {
      name: 'greeting-tool',
      desc: 'Example tool that returns a greeting and demonstrates streaming progress reporting via context.reportProgress().',
    },
    {
      name: 'generate-image-tool',
      desc: 'Generates an image from a text prompt via InvokeAI, stores it in MongoDB, and returns a chat-renderable image URL.',
    },
  ];

  resilientGenerationSteps = [
    {
      n: '1',
      title: 'Chat ID sent immediately',
      detail:
        'ChatMetadata is created (and its name decided) before any model output starts, and a created_chat event fires right away so the browser updates its URL well before the first token arrives.',
    },
    {
      n: '2',
      title: 'Writes never abort generation',
      detail:
        "a dead client socket's write errors are swallowed instead of thrown, so a disconnect can't cut the tool-call/completion loop short — the chat only unlocks once the exchange actually finishes.",
    },
    {
      n: '3',
      title: 'Per-chat generation buffer',
      detail:
        "every SSE chunk sent is buffered and broadcast, keyed by chat id — including an echo of the user's own turn, since it isn't in persisted history until the whole exchange finishes.",
    },
    {
      n: '4',
      title: 'Resume endpoint',
      detail:
        'GET /openai/completions-stream/resume replays everything buffered so far for a chat, then streams live chunks until it finishes.',
    },
    {
      n: '5',
      title: 'Automatic frontend reattachment',
      detail:
        "if a chat's metadata comes back locked when opened, the frontend reconnects and renders exactly like a freshly-submitted message — tool calls, reasoning, all of it.",
    },
    {
      n: '6',
      title: 'Honest status text',
      detail:
        '"AI is generating a response…" is shown while watching a resumed/shared generation — not the old "someone else is generating" message, which is now reserved for the brief window before a poll actually attaches.',
    },
    {
      n: '7',
      title: 'Sidebar indicator',
      detail:
        'in-progress chats get an animated wave background and a pulsing dot, backed by a 5-second self-healing poll so it never gets stuck on after you navigate away.',
    },
  ];

  customMcpSteps = [
    {
      n: '1',
      title: 'Register',
      detail:
        'paste an endpoint URL in the MCP Servers dialog — the backend connects and auto-discovers the server name and full tool list.',
    },
    {
      n: '2',
      title: 'Toggle',
      detail:
        'switch a server on/off, or allow/deny individual tools, account-wide. Saved immediately.',
    },
    {
      n: '3',
      title: 'Refresh',
      detail:
        're-run discovery any time — new tools are allowed by default, removed tools are dropped, existing choices are preserved.',
    },
    {
      n: '4',
      title: 'Per-chat overrides',
      detail:
        "opt a specific chat out of a server or tool from the New Chat dialog or a chat's settings, without touching the account default.",
    },
    {
      n: '5',
      title: 'Request-time merge',
      detail:
        "on every Chat Completions request, the backend merges each active server's allowed tools (minus this chat's overrides) in alongside the built-in tool set, routing tool calls back to the correct server.",
    },
  ];

  invokeSteps = [
    {
      n: '1',
      title: 'Tool call',
      detail: 'the model calls generate-image-tool with a natural-language prompt string.',
    },
    {
      n: '2',
      title: 'Model lookup',
      detail:
        'InvokeService queries InvokeAI\'s /api/v2/models/ endpoint for the first model matching the requested name (default: "Dreamshaper 8").',
    },
    {
      n: '3',
      title: 'Job submission',
      detail:
        'a txt2img pipeline graph (512×512, 30 steps, dpmpp_3m_k scheduler, CFG 7.5) is submitted via POST /api/v1/queue/default/enqueue_batch.',
    },
    {
      n: '4',
      title: 'Socket.IO listener',
      detail:
        'the service subscribes to the default queue over Socket.IO and waits for an invocation_complete event with the generated image name.',
    },
    {
      n: '5',
      title: 'Download & persist',
      detail:
        'the image is downloaded from /api/v1/images/i/{name}/full and stored as a binary blob via AssetsService.',
    },
    {
      n: '6',
      title: 'URL construction',
      detail:
        'a public asset URL ({SELF_URL}/assets/filequery/{filename}?chatId=...) is returned and rendered as a Markdown image in the chat.',
    },
  ];

  imageFormats = ['JPEG', 'PNG', 'WebP', 'GIF', 'AVIF'];

  voiceInputSteps = [
    {
      n: '1',
      title: 'Switch modes',
      detail:
        'a mic/pencil toggle in the action row swaps the markdown editor for a voice-recording panel (fade/scale transition) — your typed draft is preserved underneath and restored when you switch back.',
    },
    {
      n: '2',
      title: 'Record',
      detail:
        "tap the mic in the panel to capture microphone audio via the Web Audio API (AudioContext + ScriptProcessorNode) and hand-encode it as 16-bit PCM WAV on stop — MediaRecorder's default webm/opus output isn't decodable by llama.cpp's audio input.",
    },
    {
      n: '3',
      title: 'Live visualiser',
      detail:
        'an AnalyserNode tapped in parallel with the recording processor (no extra dependencies) drives a real-time bar visualiser on a <canvas>, redrawn every animation frame.',
    },
    {
      n: '4',
      title: 'Review, re-record, or remove',
      detail:
        'once stopped, the panel shows the recording in the same audio-player bubble used elsewhere in the chat, with re-record and remove controls before you send. Text is optional — audio-only messages are allowed.',
    },
    {
      n: '5',
      title: 'Send',
      detail:
        'the recording is base64-encoded and sent as a Chat Completions input_audio content part tagged userRecorded: true: { "type": "input_audio", "input_audio": { "data": "<base64 WAV>", "format": "wav" }, "userRecorded": true }.',
    },
    {
      n: '6',
      title: 'System prompt injection',
      detail:
        "whenever a request contains an input_audio part that wasn't transcribed (see Voice Transcription), the backend injects an extra system message instructing the model to treat what was said as the user's actual message.",
    },
    {
      n: '7',
      title: 'Playback',
      detail:
        'recorded voice messages render as a custom audio player bubble (play/pause, seekable progress bar, elapsed/total time) matching the chat UI, both when freshly sent and after reloading chat history.',
    },
  ];

  voiceTranscriptionSteps = [
    {
      n: '1',
      title: 'Opt in per chat',
      detail:
        'toggle "Transcribe audio" in the chat settings dialog (or at chat-creation time). Stored as ChatMetadata.transcribeAudio — off by default.',
    },
    {
      n: '2',
      title: 'Only mic recordings qualify',
      detail:
        'the backend only transcribes input_audio parts marked userRecorded: true by the client — i.e. captured via the mic panel, not any other audio source.',
    },
    {
      n: '3',
      title: 'Separate, untracked LLM call',
      detail:
        'before the main turn runs, a system message instructs the model to act as a pure transcription engine (never answer, never act on what\'s said), paired with a user turn containing only the audio. Tokens are never added to the usage counter — same as the "let AI decide chat name" call.',
    },
    {
      n: '4',
      title: 'In-place replacement',
      detail:
        'the transcript replaces the input_audio part with a plain { "type": "text" } part before the main turn is sent — from there it\'s indistinguishable from a typed message: same tool-calling, reasoning, and history persistence.',
    },
    {
      n: '5',
      title: 'Live UI update',
      detail:
        'an audio_transcript SSE event fires as soon as the transcript is ready, swapping the just-sent audio bubble to a text bubble labeled "transcribed" without waiting for the rest of the response.',
    },
  ];

  encryptionFlow = [
    {
      n: '1',
      title: 'Session created',
      detail: 'cryptoKey generated & stored in chat_metadata. Never leaves MongoDB.',
      circleClass: 'bg-warn-bg border-warn-border text-warn-text',
    },
    {
      n: '2',
      title: 'Encrypt',
      detail:
        'Backend runs CryptoJS.AES.encrypt() on all message content before forwarding to the inference server.',
      circleClass: 'bg-warn-bg border-warn-border text-warn-text',
    },
    {
      n: '3',
      title: 'Prompt inject',
      detail: 'Developer-turn instruction injected: always call decrypt-message-tool first.',
      circleClass: 'bg-accent/15 border-accent/30 text-accent',
    },
    {
      n: '4',
      title: 'MCP decrypt',
      detail:
        'The model calls back — decrypt-message-tool fetches the key from DB and returns plaintext.',
      circleClass: 'bg-reasoning-bg border-reasoning-border text-reasoning-text',
    },
    {
      n: '5',
      title: 'Answer',
      detail: 'Model answers the decrypted question. The cycle is invisible to the end user.',
      circleClass: 'bg-success-bg border-success-border text-success-text',
    },
  ];

  securityBoundaries = [
    { what: 'cryptoKey', where: 'chat_metadata MongoDB document', plaintext: true },
    {
      what: 'Messages → inference server',
      where: 'Inference server message store',
      plaintext: false,
    },
    { what: 'Browser → NestJS (HTTP body)', where: 'HTTPS in production', plaintext: true },
    { what: 'chatId MCP header', where: 'MCP request header (key lookup)', plaintext: true },
  ];

  tokenTiers = [
    {
      label: 'Free',
      tokens: 'Configurable',
      cardClass: 'bg-surface-raised border-border-default',
      labelClass: 'text-text-muted',
    },
    {
      label: 'Basic',
      tokens: 'Configurable',
      cardClass: 'bg-accent-subtle border-accent/25',
      labelClass: 'text-accent',
    },
    {
      label: 'Custom',
      tokens: 'DB-driven',
      cardClass: 'bg-reasoning-bg border-reasoning-border',
      labelClass: 'text-reasoning-text',
    },
  ];

  authItems = [
    {
      title: 'Registration',
      desc: 'POST /auth/register creates a user with a bcrypt-hashed password. New accounts are inactive until an activation link is used.',
      icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
      iconBg: 'bg-success-bg',
      iconColor: 'text-success-text',
    },
    {
      title: 'Login',
      desc: 'POST /auth/login returns a signed JWT (1-hour expiry). The Angular root component auto-redirects to /login when the token expires.',
      icon: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1',
      iconBg: 'bg-tool-bg',
      iconColor: 'text-tool-text',
    },
    {
      title: 'JWT Guard',
      desc: 'JwtAuthGuard is applied globally as an APP_GUARD. Individual routes are opted out with the @Public() decorator.',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      iconBg: 'bg-accent/15',
      iconColor: 'text-accent',
    },
    {
      title: 'Role-Based Access',
      desc: 'RolesGuard enforces @Roles(Role.Admin) and @Roles(Role.User) decorators on individual endpoints.',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      iconBg: 'bg-reasoning-bg',
      iconColor: 'text-reasoning-text',
    },
  ];

  apiRoutes = [
    {
      method: 'POST',
      path: '/auth/register',
      desc: 'Create a new user account',
      methodClass: 'bg-success-bg text-success-text border border-success-border',
    },
    {
      method: 'POST',
      path: '/auth/login',
      desc: 'Authenticate and receive a JWT',
      methodClass: 'bg-success-bg text-success-text border border-success-border',
    },
    {
      method: 'POST',
      path: '/auth/mcp-servers',
      desc: 'Register a custom MCP server (auto-discovers name + tools)',
      methodClass: 'bg-success-bg text-success-text border border-success-border',
    },
    {
      method: 'PATCH',
      path: '/auth/mcp-servers/:id',
      desc: 'Toggle a custom MCP server on/off or edit its allowed tools',
      methodClass: 'bg-warn-bg text-warn-text border border-warn-border',
    },
    {
      method: 'POST',
      path: '/auth/mcp-servers/:id/refresh',
      desc: "Re-discover a custom MCP server's tool list",
      methodClass: 'bg-success-bg text-success-text border border-success-border',
    },
    {
      method: 'DELETE',
      path: '/auth/mcp-servers/:id',
      desc: 'Remove a custom MCP server',
      methodClass: 'bg-error-bg text-error-text border border-error-border',
    },
    {
      method: 'GET',
      path: '/openai/models',
      desc: 'List models via OpenAI SDK',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'POST',
      path: '/openai/completions-stream',
      desc: 'Streaming SSE via Chat Completions API with client-side MCP tool orchestration — the only supported chat path',
      methodClass: 'bg-success-bg text-success-text border border-success-border',
    },
    {
      method: 'GET',
      path: '/openai/completions-stream/resume',
      desc: 'Reattach to a generation already in-flight for a chat — see Resilient Background Generation',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'GET',
      path: '/chat-metadata',
      desc: "List the user's chat sessions",
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'GET',
      path: '/chat-metadata/:id',
      desc: 'Get a single chat session',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'POST',
      path: '/chat-metadata',
      desc: 'Create a chat session',
      methodClass: 'bg-success-bg text-success-text border border-success-border',
    },
    {
      method: 'PATCH',
      path: '/chat-metadata/:id',
      desc: 'Update a chat session',
      methodClass: 'bg-warn-bg text-warn-text border border-warn-border',
    },
    {
      method: 'DELETE',
      path: '/chat-metadata/:id',
      desc: 'Delete a chat session',
      methodClass: 'bg-error-bg text-error-text border border-error-border',
    },
    {
      method: 'GET',
      path: '/chats/:chatId',
      desc: 'Retrieve messages for a session',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'POST',
      path: '/assets/:chatId',
      desc: 'Upload an image for a chat session',
      methodClass: 'bg-success-bg text-success-text border border-success-border',
    },
    {
      method: 'GET',
      path: '/assets/:chatId/:filename',
      desc: 'Retrieve an uploaded image (owner or shared-chat access)',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'GET',
      path: '/assets/filequery/:filename?chatId=',
      desc: 'Retrieve an image by query param (authenticated, used for AI-generated image references)',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'GET',
      path: '/invoke/test',
      desc: 'Test endpoint — generates a sample image via InvokeAI',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'GET/POST',
      path: '/tools/mcp',
      desc: 'MCP server endpoint (SSE + Streamable HTTP)',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'GET/POST/PATCH/DELETE',
      path: '/admin/users[/...]',
      desc: 'Admin CMS — user management (role: admin only, see Admin CMS section)',
      methodClass: 'bg-warn-bg text-warn-text border border-warn-border',
    },
    {
      method: 'GET/POST/PUT/DELETE',
      path: '/token-limit-configs[/...]',
      desc: 'Admin CMS — token-limit config management (role: admin only)',
      methodClass: 'bg-warn-bg text-warn-text border border-warn-border',
    },
  ];

  adminApiRoutes = [
    {
      method: 'GET',
      path: '/admin/users',
      desc: 'List all users',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'GET',
      path: '/admin/users/subscription-types',
      desc: 'List every subscription tier name currently known to the system',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'GET',
      path: '/admin/users/:id',
      desc: 'Get a single user',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'POST',
      path: '/admin/users',
      desc: 'Create a user',
      methodClass: 'bg-success-bg text-success-text border border-success-border',
    },
    {
      method: 'PATCH',
      path: '/admin/users/:id',
      desc: 'Update a user (role, subscription, activation, password)',
      methodClass: 'bg-warn-bg text-warn-text border border-warn-border',
    },
    {
      method: 'DELETE',
      path: '/admin/users/:id',
      desc: 'Delete a user (not your own account)',
      methodClass: 'bg-error-bg text-error-text border border-error-border',
    },
    {
      method: 'POST',
      path: '/admin/users/:id/reset-tokens',
      desc: "Reset a user's token-usage counter",
      methodClass: 'bg-success-bg text-success-text border border-success-border',
    },
    {
      method: 'GET/POST',
      path: '/token-limit-configs',
      desc: 'List / create token-limit configs',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'GET',
      path: '/token-limit-configs/:id',
      desc: 'Get a config by id',
      methodClass: 'bg-tool-bg text-tool-text border border-tool-border',
    },
    {
      method: 'PUT',
      path: '/token-limit-configs/:id',
      desc: 'Update a config',
      methodClass: 'bg-warn-bg text-warn-text border border-warn-border',
    },
    {
      method: 'DELETE',
      path: '/token-limit-configs/:id',
      desc: 'Delete a config',
      methodClass: 'bg-error-bg text-error-text border border-error-border',
    },
  ];
}
