// ── FileCardComponent ────────────────────────────────────────────────────────
import {
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  createComponent,
  Directive,
  ElementRef,
  EnvironmentInjector,
  HostListener,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Pipe,
  PipeTransform,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { marked, type RendererExtension, type TokenizerExtension } from 'marked';
import katex from 'katex';
import Prism from 'prismjs';
import { Observable } from 'rxjs';
import { map, publishReplay, refCount } from 'rxjs/operators';
import { animate, style, transition, trigger } from '@angular/animations';

// ── KaTeX extensions for marked ─────────────────────────────────────────────

/** Block math: $$...$$ on its own line(s). */
const blockMathExtension: TokenizerExtension & RendererExtension = {
  name: 'blockMath',
  level: 'block',
  start(src: string) {
    return src.indexOf('$$');
  },
  tokenizer(src: string) {
    const match = src.match(/^\$\$([\s\S]+?)\$\$/);
    if (match) {
      return { type: 'blockMath', raw: match[0], text: match[1].trim() };
    }
    return undefined;
  },
  renderer(token: any) {
    try {
      return `<div class="math-block">${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `<div class="math-block math-error">${token.text}</div>`;
    }
  },
};

/** Inline math: $...$ not preceded/followed by another $. */
const inlineMathExtension: TokenizerExtension & RendererExtension = {
  name: 'inlineMath',
  level: 'inline',
  start(src: string) {
    return src.indexOf('$');
  },
  tokenizer(src: string) {
    const match = src.match(/^\$(?!\$)((?:[^$\\]|\\[\s\S])+?)\$/);
    if (match) {
      return { type: 'inlineMath', raw: match[0], text: match[1].trim() };
    }
    return undefined;
  },
  renderer(token: any) {
    try {
      return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="math-error">${token.text}</span>`;
    }
  },
};

// ── SVG icon helpers ─────────────────────────────────────────────────────────
const _svgWrap = (path: string) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const fileIconPdf = _svgWrap(
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>',
);
const fileIconDoc = _svgWrap(
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>',
);
const fileIconSheet = _svgWrap(
  '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
);
const fileIconArchive = _svgWrap(
  '<path d="M21 8v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><rect x="1" y="3" width="22" height="5" rx="2"/><line x1="10" y1="12" x2="14" y2="12"/>',
);
const fileIconVideo = _svgWrap(
  '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/>',
);
const fileIconAudio = _svgWrap(
  '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
);
const fileIconImage = _svgWrap(
  '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
);
const fileIconGeneric = _svgWrap(
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
);


// ── MarkdownPipe ─────────────────────────────────────────────────────────────
@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined, streaming = false): SafeHtml {
    if (!value) return '';
    const safe = streaming ? closeOpenCodeBlocks(value) : value;
    const html = marked.parse(safe, { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

// ── StripMarkdownPipe ────────────────────────────────────────────────────────
@Pipe({ name: 'stripMarkdown', standalone: true })
export class StripMarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .replace(/\$\$[\s\S]*?\$\$/g, '')
      .replace(/\$(?!\$)((?:[^$\\]|\\[\s\S])+?)\$/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]*`/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/\n{2,}/g, ' ')
      .replace(/\n/g, ' ')
      .trim();
  }
}


const FILE_TYPE_MAP: Record<string, { icon: string; colour: string }> = {
  pdf: { icon: fileIconPdf, colour: 'var(--color-error-text)' },
  doc: { icon: fileIconDoc, colour: 'var(--color-accent-text)' },
  docx: { icon: fileIconDoc, colour: 'var(--color-accent-text)' },
  xls: { icon: fileIconSheet, colour: 'var(--color-success-text)' },
  xlsx: { icon: fileIconSheet, colour: 'var(--color-success-text)' },
  csv: { icon: fileIconSheet, colour: 'var(--color-success-text)' },
  zip: { icon: fileIconArchive, colour: 'var(--color-tertiary-accent-text)' },
  tar: { icon: fileIconArchive, colour: 'var(--color-tertiary-accent-text)' },
  gz: { icon: fileIconArchive, colour: 'var(--color-tertiary-accent-text)' },
  mp4: { icon: fileIconVideo, colour: 'var(--color-secondary-accent-text)' },
  mov: { icon: fileIconVideo, colour: 'var(--color-secondary-accent-text)' },
  mp3: { icon: fileIconAudio, colour: 'var(--color-secondary-accent-text)' },
  wav: { icon: fileIconAudio, colour: 'var(--color-secondary-accent-text)' },
  png: { icon: fileIconImage, colour: 'var(--color-secondary-accent-text)' },
  jpg: { icon: fileIconImage, colour: 'var(--color-secondary-accent-text)' },
  jpeg: { icon: fileIconImage, colour: 'var(--color-secondary-accent-text)' },
  gif: { icon: fileIconImage, colour: 'var(--color-secondary-accent-text)' },
  svg: { icon: fileIconImage, colour: 'var(--color-secondary-accent-text)' },
  ts: { icon: fileIconImage, colour: 'var(--color-secondary-accent-text)' },
  html: { icon: fileIconImage, colour: 'var(--color-secondary-accent-text)' },
};

// ── CodeBlockComponent ───────────────────────────────────────────────────────
@Component({
  selector: 'app-code-block',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="{{
        mode === 'inAppPreview' ? 'h-full overflow-y-hidden flex flex-col-reverse' : 'my-4'
      }} rounded-lg overflow-x-auto  border border-code-border bg-code-bg text-[13.5px]"
    >
      <div
        class="flex items-center justify-between px-3.5 py-1.5 bg-code-header border-b border-code-border"
      >
        <span class="font-mono text-[11px] tracking-wide text-text-muted lowercase">{{
          lang
        }}</span>
        <button
          class="text-[11px] px-2.5 py-0.5 rounded border border-border-default text-text-muted hover:bg-surface-overlay hover:text-text-secondary transition-colors duration-150 cursor-pointer font-sans"
          (click)="onCopy()"
        >
          {{ copyLabel }}
        </button>
      </div>
      <pre
        class="m-0 px-4 py-3.5 {{
          mode === 'inAppPreview'
            ? 'h-[98%] overflow-y-scroll overflow-x-scroll '
            : 'overflow-x-auto '
        }} max-w-full  whitespace-pre bg-transparent {{language-' + lang}}"
      ><code
        [class]="'font-mono text-[13.5px] leading-[1.65] bg-transparent language-' + lang + ' text-code-variable'"
        [innerHTML]="highlighted"
      ></code></pre>
    </div>
  `,
})
export class CodeBlockComponent {
  @Input() lang = 'plaintext';
  @Input() rawText = '';
  @Input() mode?: 'inAppPreview' | 'default' = 'default';

  copyLabel = 'Copy';
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  get highlighted(): string {
    try {
      const grammar = Prism.languages[this.lang] ?? Prism.languages['plaintext'];
      return Prism.highlight(this.rawText, grammar, this.lang);
    } catch {
      return this.rawText;
    }
  }

  onCopy(): void {
    // navigator.clipboard is only available in secure contexts (HTTPS / localhost).
    // Fall back to the legacy execCommand approach when unavailable.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(this.rawText).then(() => this.flashCopied());
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = this.rawText;
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.flashCopied();
      } catch {
        console.warn('[CodeBlockComponent] Copy failed — insecure context');
      }
    }
  }

  private flashCopied(): void {
    this.copyLabel = 'Copied!';
    if (this.copyTimer) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => (this.copyLabel = 'Copy'), 2000);
  }
}

// ── helpers (add near FILE_TYPE_MAP or top of file) ──────────────────────────
const IMAGE_EXTS  = new Set(['png','jpg','jpeg','gif','webp','svg','bmp','ico','avif','tiff']);
const PREVIEWABLE = new Set(['html', 'ts', 'tsx', 'js','txt', 'py', 'json', ...IMAGE_EXTS]);
export const EXT_TO_PRISM_LANG: Record<string, string> = {
  // Web
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  mathml: 'markup',
  ssml: 'markup',
  atom: 'markup',
  rss: 'markup',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  styl: 'stylus',

  // JavaScript / TypeScript
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  coffee: 'coffeescript',
  ls: 'livescript',

  // C family
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
  cs: 'csharp',
  fs: 'fsharp',
  fsx: 'fsharp',

  // JVM
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  groovy: 'groovy',
  gradle: 'groovy',
  scala: 'scala',
  clj: 'clojure',
  cljs: 'clojure',

  // Scripting
  py: 'python',
  pyw: 'python',
  rb: 'ruby',
  rake: 'ruby',
  gemspec: 'ruby',
  php: 'php',
  php3: 'php',
  php4: 'php',
  php5: 'php',
  phtml: 'php',
  pl: 'perl',
  pm: 'perl',
  lua: 'lua',
  r: 'r',
  jl: 'julia',

  // Shell
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  psm1: 'powershell',
  psd1: 'powershell',
  bat: 'batch',
  cmd: 'batch',

  // Data / Config
  json: 'json',
  json5: 'json5',
  jsonp: 'jsonp',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  conf: 'nginx', // fallback; common for nginx/apache configs
  env: 'bash',
  properties: 'properties',
  prop: 'properties',

  // Markup / Docs
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  tex: 'latex',
  latex: 'latex',
  rst: 'rest',
  adoc: 'asciidoc',
  asciidoc: 'asciidoc',

  // Query
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',

  // Systems / Low-level
  rs: 'rust',
  go: 'go',
  swift: 'swift',
  dart: 'dart',
  zig: 'c', // no dedicated prism lang; c is closest
  asm: 'nasm',
  s: 'nasm',
  nasm: 'nasm',

  // Functional
  hs: 'haskell',
  lhs: 'haskell',
  elm: 'elm',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hrl: 'erlang',
  ml: 'ocaml',
  mli: 'ocaml',
  re: 'reason',
  rei: 'reason',
  lisp: 'lisp',
  scm: 'scheme',
  rkt: 'scheme',

  // DevOps / Infra
  dockerfile: 'docker',
  tf: 'hcl',
  hcl: 'hcl',
  nomad: 'hcl',
  makefile: 'makefile',
  mk: 'makefile',
  cmake: 'cmake',
  nginx: 'nginx',
  apacheconf: 'apacheconf',
  htaccess: 'apacheconf',

  // Templates
  ejs: 'ejs',
  hbs: 'handlebars',
  handlebars: 'handlebars',
  mustache: 'handlebars',
  pug: 'pug',
  jade: 'pug',
  twig: 'twig',
  liquid: 'liquid',
  erb: 'erb',
  njk: 'markup', // nunjucks — closest is markup

  // Other
  diff: 'diff',
  patch: 'diff',
  txt: 'plain',
  log: 'plain',
  csv: 'plain',
  proto: 'protobuf',
  vim: 'vim',
  gd: 'gdscript',
  glsl: 'glsl',
  hlsl: 'glsl',
  wgsl: 'glsl',
  mat: 'matlab',
  m: 'matlab',
  pas: 'pascal',
  pp: 'pascal',
  nim: 'nim',
  cr: 'crystal',
  v: 'c', // Verilog — no prism lang; c is closest
};
type PreviewKind = 'html' | 'image' | 'unsupported';

@Component({
  selector: 'app-file-card',
  standalone: true,
  imports: [MarkdownPipe, CodeBlockComponent],
  animations: [
    trigger('backdropAnim', [
      transition(':enter', [
        style({ opacity: 0, backdropFilter: 'blur(0px)' }),
        animate('200ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('150ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('cardAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.88) translateY(12px)' }),
        animate(
          '280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'scale(1) translateY(0)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '150ms cubic-bezier(0.4, 0, 1, 1)',
          style({ opacity: 0, transform: 'scale(0.94) translateY(6px)' }),
        ),
      ]),
    ]),
  ],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="group my-3 flex items-center gap-3 rounded-xl px-4 py-3 border border-border-default bg-surface-raised shadow-sm transition-all duration-200 cursor-pointer hover-lift"
      (click)="onCardClick($event)"
    >
      <!-- File type icon -->
      <div
        class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-surface-overlay"
        [style.color]="colour"
        [innerHTML]="icon"
      ></div>

      <!-- Filename + meta -->
      <div class="flex-1 min-w-0">
        <div class="flex md:flex-row flex-col items-start md:items-center gap-2 flex-wrap">
          <span
            class="{{
              style === 'chat' ? 'text-[14px]' : 'text-[12px]'
            }} font-medium truncate max-w-[280px] text-text-primary"
            [title]="filename"
            >{{ filename }}</span
          >
          <div class="block md:hidden flex gap-2">
            <span
              class="text-[10px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-overlay"
              [style.color]="colour"
              >{{ ext }}</span
            >
            @if (size) {
              <span
                class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-overlay text-text-muted"
              >
                {{ size }} KB
              </span>
            }
          </div>
          <span
            class="text-[10px] hidden md:block font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-overlay"
            [style.color]="colour"
            >{{ ext }}</span
          >
          @if (size) {
            <span
              class="text-[11px] hidden md:block font-medium px-1.5 py-0.5 rounded bg-surface-overlay text-text-muted"
            >
              {{ size }} KB
            </span>
          }
        </div>
        <p class="text-[11px] mt-0.5 truncate text-text-muted">{{ url }}</p>
      </div>

      <!-- Download button -->
      <a
        (click)="onDownloadClick($event)"
        [title]="'Download ' + filename"
        class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border border-accent-text bg-accent-subtle text-accent-text opacity-100 transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7.5 1.5v8M4.5 7l3 3 3-3M2.5 11.5h10"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </a>
    </div>

    <!-- ── HTML Preview Overlay ── -->
    @if (previewOpen()) {
      <div
        @backdropAnim
        class="fixed top-0 left-0 inset-0 z-10 flex items-center justify-center"
        style="background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);"
        (click)="closePreview($event)"
      >
        <div
          @cardAnim
          class="relative flex flex-col rounded-2xl border border-border-default bg-surface-raised overflow-hidden shadow-xl"
          style="width: min(92vw, 960px); height: min(88vh, 720px);"
          (click)="$event.stopPropagation()"
        >
          <!-- Header bar -->
          <div
            class="flex items-center gap-3 px-4 py-2.5 border-b border-border-default bg-surface-overlay flex-shrink-0"
          >
            <!-- Traffic-light dots -->
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-error-text opacity-70"></span>
              <span class="w-3 h-3 rounded-full bg-warn-text opacity-70"></span>
              <span class="w-3 h-3 rounded-full bg-success-text opacity-70"></span>
            </div>

            <!-- Filename pill -->
            <div
              class="flex-1 flex items-center gap-2 px-3 py-1 rounded-lg text-[12px] font-mono truncate bg-surface-base text-text-secondary border border-border-subtle"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 15 15"
                fill="none"
                class="flex-shrink-0 opacity-50"
              >
                <path
                  d="M2 2.5A.5.5 0 0 1 2.5 2h6.086a.5.5 0 0 1 .353.146l3.915 3.915A.5.5 0 0 1 13 6.415V12.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10z"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
              </svg>
              <span class="truncate">{{ filename }}</span>
            </div>

            <!-- Preview / Code toggle -->
            <div
              class="flex items-center rounded-lg border border-border-default bg-surface-base p-0.5 gap-0.5 flex-shrink-0"
            >
              <button
                (click)="previewMode.set('preview'); $event.stopPropagation()"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150"
                [class.bg-surface-overlay]="previewMode() === 'preview'"
                [class.text-text-primary]="previewMode() === 'preview'"
                [class.text-text-muted]="previewMode() !== 'preview'"
              >
                <!-- Eye icon -->
                <svg width="11" height="11" viewBox="0 0 15 15" fill="none">
                  <path
                    d="M7.5 3C4 3 1 7.5 1 7.5s3 4.5 6.5 4.5S14 7.5 14 7.5 11 3 7.5 3z"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <circle cx="7.5" cy="7.5" r="1.5" stroke="currentColor" stroke-width="1.4" />
                </svg>
                Preview
              </button>
              <button
                (click)="previewMode.set('code'); $event.stopPropagation()"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150"
                [class.bg-surface-overlay]="previewMode() === 'code'"
                [class.text-text-primary]="previewMode() === 'code'"
                [class.text-text-muted]="previewMode() !== 'code'"
              >
                <!-- Code icon -->
                <svg width="11" height="11" viewBox="0 0 15 15" fill="none">
                  <path
                    d="M5 4L1 7.5 5 11M10 4l4 3.5L10 11"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                Code
              </button>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <!-- Open externally -->
              <button
                (click)="openExternal($event)"
                title="Open in new tab"
                class="w-7 h-7 rounded-lg flex items-center justify-center border border-accent-text bg-accent-subtle text-accent-text transition-all duration-150 hover:scale-105 active:scale-95"
              >
                <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
                  <path
                    d="M3 2h9v9M12 3 5 10"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>

              <!-- Close -->
              <button
                (click)="closePreview($event)"
                title="Close preview"
                class="w-7 h-7 rounded-lg flex items-center justify-center border border-border-default bg-surface-sunken text-text-secondary transition-all duration-150 hover:scale-105 active:scale-95"
              >
                <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
                  <path
                    d="M2 2l11 11M13 2 2 13"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <!-- Content area -->
          <div class="flex-1 overflow-hidden">
            <!-- Preview tab -->
            @if (previewMode() === 'preview') {
              <!-- HTML → iframe -->
              @if (previewKind() === 'html') {
                <div class="w-full h-full bg-white">
                  @if (previewSrc()) {
                    <iframe
                      [src]="previewSrc()!"
                      class="w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin"
                      title="HTML Preview"
                    ></iframe>
                  } @else {
                    <div
                      class="w-full h-full flex flex-col items-center justify-center gap-3 bg-surface-base"
                    >
                      <div class="shimmer-bg rounded-lg" style="width: 220px; height: 16px;"></div>
                      <div class="shimmer-bg rounded-lg" style="width: 160px; height: 12px;"></div>
                    </div>
                  }
                </div>
              }

              <!-- Image → <img> -->
              @if (previewKind() === 'image') {
                <div
                  class="w-full h-full flex items-center justify-center bg-[repeating-conic-gradient(#80808018_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]"
                >
                  @if (previewSrc()) {
                    <img
                      [src]="previewSrc()!"
                      class="max-w-full max-h-full object-contain rounded shadow-lg"
                      [alt]="filename"
                    />
                  } @else {
                    <div class="flex flex-col items-center justify-center gap-3">
                      <div class="shimmer-bg rounded-lg" style="width: 220px; height: 16px;"></div>
                      <div class="shimmer-bg rounded-lg" style="width: 160px; height: 12px;"></div>
                    </div>
                  }
                </div>
              }

              <!-- Unsupported → message -->
              @if (previewKind() === 'unsupported') {
                <div
                  class="w-full h-full flex flex-col items-center justify-center gap-3 bg-surface-base select-none"
                >
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    class="text-text-muted opacity-40"
                  >
                    <path
                      d="M9 12h6M12 9v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                  <p class="text-[13px] font-medium text-text-muted">
                    Can't preview this file type
                  </p>
                  <button
                    (click)="previewMode.set('code'); $event.stopPropagation()"
                    class="mt-1 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-accent-text bg-accent-subtle text-accent-text transition-all duration-150 hover:scale-105 active:scale-95"
                  >
                    View in Code
                  </button>
                </div>
              }
            }

            <!-- Code tab: syntax-highlighted -->
            @if (previewMode() === 'code') {
              @if (rawContent()) {
                <app-code-block
                  [mode]="'inAppPreview'"
                  [lang]="EXT_TO_PRISM_LANG[ext] ?? 'plaintext'"
                  [rawText]="rawContent() ?? ''"
                />
              } @else {
                <div class="w-full h-full overflow-hidden bg-code-bg">
                  <div class="w-full h-full flex flex-col items-center justify-center gap-3">
                    <div class="shimmer-bg rounded-lg" style="width: 220px; height: 16px;"></div>
                    <div class="shimmer-bg rounded-lg" style="width: 160px; height: 12px;"></div>
                  </div>
                </div>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class FileCardComponent {
  EXT_TO_PRISM_LANG = EXT_TO_PRISM_LANG;
  @Input() filename = '';
  @Input() url = '';
  @Input() style: 'chat' | 'sidebar' = 'chat';
  @Input() size = 0;
  @Input() ext = 'file';
  @Input() mimeType?: string = '';

  readonly previewOpen = signal(false);
  readonly previewMode = signal<'preview' | 'code'>('preview');
  readonly previewSrc = signal<SafeResourceUrl | null>(null);
  readonly rawContent = signal<string | null>(null);
  readonly previewKind = signal<PreviewKind>('html'); // ← new

  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private static readonly cache = new Map<string, string | Observable<string>>();

  get colour(): string {
    return FILE_TYPE_MAP[this.ext]?.colour ?? 'var(--color-text-muted)';
  }

  get icon(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(FILE_TYPE_MAP[this.ext]?.icon ?? fileIconGeneric);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.previewOpen()) this.previewOpen.set(false);
  }

  onCardClick(e: MouseEvent): void {
    if (PREVIEWABLE.has(this.ext)) {
      this.openInAppPreview();
    } else {
      this.fetchBlobUrl(this.url).subscribe({
        next: (blobUrl) => window.open(blobUrl, '_blank', 'noopener,noreferrer'),
        error: () => console.warn(`[FileCardComponent] Failed to open: ${this.url}`),
      });
    }
  }

  onDownloadClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.fetchBlobUrl(this.url).subscribe({
      next: (blobUrl) => {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = this.filename;
        a.click();
      },
      error: () => console.warn(`[FileCardComponent] Failed to download: ${this.url}`),
    });
  }

  openExternal(e: MouseEvent): void {
    e.stopPropagation();
    this.fetchBlobUrl(this.url).subscribe({
      next: (blobUrl) => window.open(blobUrl, '_blank', 'noopener,noreferrer'),
      error: () => console.warn(`[FileCardComponent] Failed to open externally: ${this.url}`),
    });
  }

  closePreview(e: MouseEvent): void {
    e.stopPropagation();
    this.previewOpen.set(false);
  }

  // ── unified entry point ────────────────────────────────────────────────────
  private openInAppPreview(): void {
    this.previewSrc.set(null);
    this.rawContent.set(null);
    this.previewOpen.set(true);

    if (this.ext === 'html') {
      this.previewKind.set('html');
      this.previewMode.set('preview');
      this.loadHtml();
    } else if (IMAGE_EXTS.has(this.ext)) {
      this.previewKind.set('image');
      this.previewMode.set('preview');
      this.loadImage();
    } else {
      // ALL other types: unsupported visual preview, raw text in code tab
      this.previewKind.set('unsupported');
      this.previewMode.set('preview');
      this.loadRawText();
    }
  }

  // ── loaders ───────────────────────────────────────────────────────────────
  private loadHtml(): void {
    const token = localStorage.getItem('jwt_token') ?? '';
    this.http
      .get(this.url, { responseType: 'text', headers: { Authorization: `Bearer ${token}` } })
      .subscribe({
        next: (text) => {
          this.rawContent.set(text);
          const blob = new Blob([text], { type: 'text/html' });
          const blobUrl = URL.createObjectURL(blob);
          FileCardComponent.cache.set(this.url, blobUrl);
          this.previewSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl));
        },
        error: () => {
          console.warn(`[FileCardComponent] Failed to load HTML preview: ${this.url}`);
          this.previewOpen.set(false);
        },
      });
  }

  private loadImage(): void {
    this.fetchBlobUrl(this.url).subscribe({
      next: (blobUrl) =>
        this.previewSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl)),
      error: () => {
        console.warn(`[FileCardComponent] Failed to load image preview: ${this.url}`);
        this.previewOpen.set(false);
      },
    });
  }

  private loadRawText(): void {
    const token = localStorage.getItem('jwt_token') ?? '';
    this.http
      .get(this.url, { responseType: 'text', headers: { Authorization: `Bearer ${token}` } })
      .subscribe({
        next: (text) => this.rawContent.set(text),
        error: () => console.warn(`[FileCardComponent] Failed to load raw content: ${this.url}`),
      });
  }

  // ── blob cache ────────────────────────────────────────────────────────────
  private fetchBlobUrl(src: string): Observable<string> {
    const cached = FileCardComponent.cache.get(src);
    if (typeof cached === 'string')
      return new Observable((o) => {
        o.next(cached);
        o.complete();
      });
    if (cached instanceof Observable) return cached;

    const token = localStorage.getItem('jwt_token') ?? '';
    const blobUrl$ = this.http
      .get(src, { responseType: 'blob', headers: { Authorization: `Bearer ${token}` } })
      .pipe(
        map((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          FileCardComponent.cache.set(src, blobUrl);
          return blobUrl;
        }),
        publishReplay(1),
        refCount(),
      );

    FileCardComponent.cache.set(src, blobUrl$);
    return blobUrl$;
  }

  static clearCache(): void {
    FileCardComponent.cache.forEach((entry) => {
      if (typeof entry === 'string') URL.revokeObjectURL(entry);
    });
    FileCardComponent.cache.clear();
  }
}
// ── ImageLightboxComponent ────────────────────────────────────────────────────
// Singleton Angular component bootstrapped once into document.body.
// Call ImageLightboxComponent.open(url, http) / showCtxMenu() from anywhere.
@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      @keyframes lightbox-fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes lightbox-scale-in {
        from {
          transform: scale(0.93);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }
      @keyframes lightbox-spin {
        to {
          transform: rotate(360deg);
        }
      }
      @keyframes ctx-fade-in {
        from {
          opacity: 0;
          transform: scale(0.96);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .lb-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
        animation: lightbox-fade-in 0.2s ease;
      }
      .lb-img {
        max-width: 100%;
        max-height: calc(100vh - 48px);
        border-radius: 8px;
        object-fit: contain;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
        transition: opacity 0.2s ease;
        animation: lightbox-scale-in 0.25s ease;
        display: block;
      }
      .lb-close:hover {
        background: rgba(255, 255, 255, 0.2) !important;
      }
      .lb-spinner-svg {
        animation: lightbox-spin 0.8s linear infinite;
      }
      .lb-ctx-menu {
        position: fixed;
        z-index: 10000;
        width: 208px;
        background: var(--color-surface-raised, #1c1c1e);
        border: 1px solid var(--color-border-default, rgba(255, 255, 255, 0.1));
        border-radius: 12px;
        overflow: hidden;
        padding: 4px 0;
        box-shadow: var(--shadow-xl, 0 20px 60px rgba(0, 0, 0, 0.7));
        animation: ctx-fade-in 0.12s ease;
      }
      .lb-ctx-header {
        padding: 6px 12px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--color-text-muted, rgba(255, 255, 255, 0.4));
        border-bottom: 1px solid var(--color-border-default, rgba(255, 255, 255, 0.08));
      }
      .lb-ctx-btn {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 12px;
        font-size: 12px;
        color: var(--color-text-secondary, rgba(255, 255, 255, 0.65));
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        transition:
          background 0.12s ease,
          color 0.12s ease;
      }
      .lb-ctx-btn:hover {
        background: var(--color-surface-overlay, rgba(255, 255, 255, 0.07));
        color: var(--color-text-primary, #fff);
      }
      .lb-ctx-btn svg {
        flex-shrink: 0;
        opacity: 0.6;
      }
    `,
  ],
  template: `
    @if (visible) {
      <div class="lb-overlay" (click)="onOverlayClick($event)" (mousedown)="closeCtxMenu()">
        <!-- Close button -->
        <button
          class="lb-close"
          aria-label="Close image"
          (click)="close()"
          style="position:absolute;top:16px;right:16px;width:36px;height:36px;
                 border-radius:50%;border:none;background:rgba(255,255,255,0.12);
                 color:#fff;font-size:16px;cursor:pointer;
                 display:flex;align-items:center;justify-content:center;
                 transition:background 0.15s ease;z-index:1;"
        >
          ✕
        </button>

        <!-- Spinner -->
        @if (loading) {
          <div
            style="position:absolute;display:flex;align-items:center;
                      justify-content:center;color:rgba(255,255,255,0.7);font-size:14px;gap:10px;"
          >
            <svg class="lb-spinner-svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.2)" stroke-width="3" />
              <path
                d="M14 3 A11 11 0 0 1 25 14"
                stroke="white"
                stroke-width="3"
                stroke-linecap="round"
              />
            </svg>
            <span>Loading full image…</span>
          </div>
        }

        <!-- Error -->
        @if (error) {
          <div
            style="display:flex;align-items:center;gap:8px;
                      color:rgba(255,120,120,0.9);font-size:14px;"
          >
            <span>⚠</span><span>Failed to load full image.</span>
          </div>
        }

        <!-- Image -->
        @if (blobSrc) {
          <img
            class="lb-img"
            [src]="blobSrc"
            [style.opacity]="imgReady ? '1' : '0'"
            (load)="onImgLoad()"
            (contextmenu)="onImgContextMenu($event)"
          />
        }
      </div>
    }

    <!-- Context menu — outside the overlay so overlay mousedown doesn't swallow it -->
    @if (ctxMenu) {
      <div class="lb-ctx-menu" [style.left.px]="ctxMenu.x" [style.top.px]="ctxMenu.y">
        <div class="lb-ctx-header">Image</div>
        <button type="button" class="lb-ctx-btn" (click)="onCtxDownload()">
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 3v12"
            />
          </svg>
          Download image
        </button>
      </div>
    }
  `,
})
export class ImageLightboxComponent implements OnDestroy {
  visible = false;
  loading = false;
  error = false;
  blobSrc = '';
  imgReady = false;
  ctxMenu: { x: number; y: number } | null = null;

  private currentBlobUrl: string | null = null;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly escListener = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };
  private ctxOutsideListener: ((e: MouseEvent) => void) | null = null;

  // ── Singleton bootstrap ──────────────────────────────────────────────────
  private static instance: ImageLightboxComponent | null = null;

  static bootstrap(appRef: ApplicationRef, injector: EnvironmentInjector): void {
    if (this.instance) return;
    const ref = createComponent(ImageLightboxComponent, { environmentInjector: injector });
    appRef.attachView(ref.hostView);
    document.body.appendChild(ref.location.nativeElement);
    this.instance = ref.instance;
  }

  /** Called by AuthImageComponent on click. */
  static open(fullUrl: string, http: HttpClient): void {
    this.instance?.openImage(fullUrl, http);
  }

  /** Called by AuthImageComponent on contextmenu. */
  static showCtxMenu(blobUrl: string, clientX: number, clientY: number): void {
    this.instance?.showCtxMenuAt(blobUrl, clientX, clientY);
  }

  // ── Instance methods ─────────────────────────────────────────────────────

  openImage(fullUrl: string, http: HttpClient): void {
    this.visible = true;
    this.loading = true;
    this.error = false;
    this.blobSrc = '';
    this.imgReady = false;
    this.ctxMenu = null;

    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    document.addEventListener('keydown', this.escListener);
    this.cdr.markForCheck();

    const url = new URL(fullUrl, window.location.origin);
    url.searchParams.delete('thumbnail');
    const token = localStorage.getItem('jwt_token') ?? '';

    http
      .get(url.toString(), { responseType: 'blob', headers: { Authorization: `Bearer ${token}` } })
      .subscribe({
        next: (blob) => {
          const blobUrl = URL.createObjectURL(blob);
          this.currentBlobUrl = blobUrl;
          this.loading = false;
          this.blobSrc = blobUrl;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.error = true;
          this.cdr.markForCheck();
        },
      });
  }

  close(): void {
    this.visible = false;
    this.ctxMenu = null;
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    document.removeEventListener('keydown', this.escListener);
    this.cdr.markForCheck();
  }

  showCtxMenuAt(blobUrl: string, clientX: number, clientY: number): void {
    this.currentBlobUrl = blobUrl;
    const menuW = 208,
      menuH = 72;
    this.ctxMenu = {
      x: Math.min(clientX, window.innerWidth - menuW - 8),
      y: Math.min(clientY, window.innerHeight - menuH - 8),
    };
    this.cdr.markForCheck();

    if (this.ctxOutsideListener) {
      document.removeEventListener('mousedown', this.ctxOutsideListener);
    }
    this.ctxOutsideListener = () => {
      this.closeCtxMenu();
      document.removeEventListener('mousedown', this.ctxOutsideListener!);
    };
    setTimeout(() => document.addEventListener('mousedown', this.ctxOutsideListener!), 0);
  }

  closeCtxMenu(): void {
    if (!this.ctxMenu) return;
    this.ctxMenu = null;
    this.cdr.markForCheck();
  }

  onOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.close();
  }

  onImgLoad(): void {
    this.imgReady = true;
    this.cdr.markForCheck();
  }

  onImgContextMenu(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.currentBlobUrl) this.showCtxMenuAt(this.currentBlobUrl, e.clientX, e.clientY);
  }

  onCtxDownload(): void {
    if (!this.currentBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.currentBlobUrl;
    a.download = 'image';
    a.click();
    this.closeCtxMenu();
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.escListener);
    if (this.currentBlobUrl) URL.revokeObjectURL(this.currentBlobUrl);
    ImageLightboxComponent.instance = null;
  }
}

// ── AuthImageComponent ───────────────────────────────────────────────────────
@Component({
  selector: 'app-auth-image',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `
    <img
      [src]="blobSrc"
      [alt]="alt"
      [title]="title"
      [attr.loading]="loading ? 'true' : null"
      class="rounded-md max-w-full cursor-pointer transition-all ease-in-out duration-500"
      (click)="onImageClick()"
      (contextmenu)="onContextMenu($event)"
    />
  `,
})
export class AuthImageComponent implements OnInit, OnDestroy {
  @Input() authSrc = '';
  @Input() alt = '';
  @Input() title = '';

  blobSrc = '';
  loading = false;

  private readonly http = inject(HttpClient);
  private ownedBlobUrl: string | null = null;
  private readonly cdr = inject(ChangeDetectorRef);

  private static readonly cache = new Map<string, string | Observable<string>>();

  ngOnInit(): void {
    this.loadImage();
  }

  ngOnDestroy(): void {
    if (this.ownedBlobUrl) {
      const stillCached = [...AuthImageComponent.cache.values()].includes(this.ownedBlobUrl);
      if (!stillCached) URL.revokeObjectURL(this.ownedBlobUrl);
    }
  }

  onImageClick(): void {
    ImageLightboxComponent.open(this.authSrc, this.http);
  }

  onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const currentBlobUrl = this.blobSrc.startsWith('blob:') ? this.blobSrc : null;
    if (currentBlobUrl) ImageLightboxComponent.showCtxMenu(currentBlobUrl, e.clientX, e.clientY);
  }

  private loadImage(): void {
    const src = this.authSrc;
    if (!src) return;

    const cached = AuthImageComponent.cache.get(src);
    if (typeof cached === 'string') {
      this.blobSrc = cached;
      return;
    }

    this.loading = true;
    const token = localStorage.getItem('jwt_token') ?? '';

    const inflight =
      cached instanceof Observable
        ? cached
        : (() => {
            const obs$ = this.http
              .get(src, { responseType: 'blob', headers: { Authorization: `Bearer ${token}` } })
              .pipe(
                map((blob) => {
                  const blobUrl = URL.createObjectURL(blob);
                  AuthImageComponent.cache.set(src, blobUrl);
                  return blobUrl;
                }),
                publishReplay(1),
                refCount(),
              );
            AuthImageComponent.cache.set(src, obs$);
            return obs$;
          })();

    inflight.subscribe({
      next: (blobUrl) => {
        this.ownedBlobUrl = blobUrl;
        this.loading = false;
        this.blobSrc = blobUrl;
        this.cdr.markForCheck();
      },
      error: () => {
        AuthImageComponent.cache.delete(src);
        this.loading = false;
        this.alt = `Failed to load image: ${src}`;
        this.cdr.markForCheck();
      },
    });
  }

  static clearCache(): void {
    AuthImageComponent.cache.forEach((entry) => {
      if (typeof entry === 'string') URL.revokeObjectURL(entry);
    });
    AuthImageComponent.cache.clear();
  }
}

// ── marked extensions ────────────────────────────────────────────────────────

// ── Code block extension: ```lang ... ``` ────────────────────────────────────
const fencedCodeExtension: TokenizerExtension & RendererExtension = {
  name: 'fencedCode',
  level: 'block',
  start(src: string) {
    return src.indexOf('```');
  },
  tokenizer(src: string) {
    const match = src.match(/^`{3}[ \t]*(\w*)[^\n]*\n([\s\S]*?)`{3}/);
    if (match) {
      return {
        type: 'fencedCode',
        raw: match[0],
        lang: match[1] || 'plaintext',
        text: match[2],
      };
    }
    return undefined;
  },
  renderer(token: any) {
    return `<app-code-block data-lang="${encodeURIComponent(token.lang || 'plaintext')}" data-raw="${encodeURIComponent(token.text)}"></app-code-block>`;
  },
};

// ── Inline code extension: `code` ───────────────────────────────────────────
const inlineCodeExtension: TokenizerExtension & RendererExtension = {
  name: 'inlineCode',
  level: 'inline',
  start(src: string) {
    return src.indexOf('`');
  },
  tokenizer(src: string) {
    const match = src.match(/^`([^`]+)`/);
    if (match) {
      return { type: 'inlineCode', raw: match[0], text: match[1] };
    }
    return undefined;
  },
  renderer(token: any) {
    return `<code class="font-mono text-[0.875em] px-1.5 py-px rounded bg-[var(--color-surface-overlay)] text-[var(--color-tertiary-accent-text)] border border-[var(--color-border-subtle)]">${token.text}</code>`;
  },
};

// ── Link renderer: open in new tab ──────────────────────────────────────────
const renderer = new marked.Renderer();

renderer.link = ({ href, title, text }) => {
  const titleAttr = title ? ` title="${title}"` : '';
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};

// ── Image renderer: emit placeholder for AuthImageMountDirective ─────────────
renderer.image = ({ href, title, text }) => {
  if (!href) return '';
  return `<app-auth-image data-auth-src="${encodeURIComponent(href)}" data-alt="${encodeURIComponent(text ?? '')}" data-title="${encodeURIComponent(title ?? '')}"></app-auth-image>`;
};

// ── File card extension: ::file[name](url){size=X type=Y} ───────────────────
const fileCardExtension: TokenizerExtension & RendererExtension = {
  name: 'fileCard',
  level: 'block',
  start(src: string) {
    return src.indexOf('::file[');
  },
  tokenizer(src: string) {
    const match = src.match(/^::file\[([^\]]*)\]\(([^)]*)\)(?:\{([^}]*)\})?[ \t]*(?:\n|$)/);
    if (match) {
      const attrs: Record<string, string> = {};
      if (match[3]) {
        for (const part of match[3].split(/\s+/)) {
          const [k, v] = part.split('=');
          if (k && v !== undefined) attrs[k.trim()] = v.trim();
        }
      }
      return {
        type: 'fileCard',
        raw: match[0],
        filename: match[1].trim(),
        url: match[2].trim(),
        attrs,
      };
    }
    return undefined;
  },
  renderer(token: any) {
    const { filename, url, attrs } = token as {
      filename: string;
      url: string;
      attrs: Record<string, string>;
    };
    const ext = (attrs['type'] ?? filename.split('.').pop() ?? 'file').toLowerCase().replace('.','');
    const size = attrs['size'] ?? '';
    return `<app-file-card data-filename="${encodeURIComponent(filename)}" data-url="${encodeURIComponent(url)}" data-ext="${encodeURIComponent(ext)}" data-size="${encodeURIComponent(size)}"></app-file-card>`;
  },
};

marked.use({
  extensions: [
    blockMathExtension,
    inlineMathExtension,
    fencedCodeExtension,
    inlineCodeExtension,
    fileCardExtension,
  ],
  renderer,
});

// ── ComponentMountDirective ───────────────────────────────────────────────────
// Base class: defers initial scan by one microtask so [innerHTML] has already
// been flushed by Angular, then watches for further DOM mutations.
@Directive()
abstract class ComponentMountDirective implements OnInit, OnDestroy {
  protected abstract readonly el: ElementRef<HTMLElement>;
  protected observer: MutationObserver | null = null;
  protected readonly componentRefs: ReturnType<typeof createComponent>[] = [];

  ngOnInit(): void {
    // Defer so Angular has flushed [innerHTML] before we scan.
    Promise.resolve().then(() => this.mountAll(this.el.nativeElement));

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) this.mountAll(node);
        });
      }
    });
    this.observer.observe(this.el.nativeElement, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.componentRefs.forEach((ref) => ref.destroy());
    this.componentRefs.length = 0;
  }

  protected abstract mountAll(root: HTMLElement): void;
}

// ── CodeBlockMountDirective ──────────────────────────────────────────────────
@Directive({ selector: '[mountCodeBlocks]', standalone: true })
export class CodeBlockMountDirective extends ComponentMountDirective {
  protected readonly el = inject(ElementRef<HTMLElement>);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  protected mountAll(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('app-code-block[data-lang]').forEach((placeholder) => {
      const lang = decodeURIComponent(placeholder.dataset['lang'] ?? 'plaintext');
      const rawText = decodeURIComponent(placeholder.dataset['raw'] ?? '');

      const ref = createComponent(CodeBlockComponent, { environmentInjector: this.injector });
      ref.instance.lang = lang;
      ref.instance.rawText = rawText;
      ref.changeDetectorRef.detectChanges();

      placeholder.replaceWith(ref.location.nativeElement);
      this.appRef.attachView(ref.hostView);
      this.componentRefs.push(ref);
    });
  }
}

// ── FileCardMountDirective ───────────────────────────────────────────────────
@Directive({ selector: '[mountFileCards]', standalone: true })
export class FileCardMountDirective extends ComponentMountDirective {
  protected readonly el = inject(ElementRef<HTMLElement>);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  protected mountAll(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('app-file-card[data-filename]').forEach((placeholder) => {
      const filename = decodeURIComponent(placeholder.dataset['filename'] ?? '');
      const url = decodeURIComponent(placeholder.dataset['url'] ?? '');
      const ext = decodeURIComponent(placeholder.dataset['ext'] ?? 'file');
      const size = decodeURIComponent(placeholder.dataset['size'] ?? '');

      const mimeType = decodeURIComponent(placeholder.dataset['mimeType'] ?? 'document');

      const ref = createComponent(FileCardComponent, { environmentInjector: this.injector });
      ref.instance.filename = filename;
      ref.instance.url = url;
      ref.instance.ext = ext;
      ref.instance.mimeType = mimeType;
      ref.instance.size = parseFloat(size ?? 0);
      ref.changeDetectorRef.detectChanges();

      placeholder.replaceWith(ref.location.nativeElement);
      this.appRef.attachView(ref.hostView);
      this.componentRefs.push(ref);
    });
  }
}

// ── AuthImageMountDirective ──────────────────────────────────────────────────
@Directive({ selector: '[mountAuthImages]', standalone: true })
export class AuthImageMountDirective extends ComponentMountDirective {
  protected readonly el = inject(ElementRef<HTMLElement>);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  protected mountAll(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('app-auth-image[data-auth-src]').forEach((placeholder) => {
      const authSrc = decodeURIComponent(placeholder.dataset['authSrc'] ?? '');
      const alt = decodeURIComponent(placeholder.dataset['alt'] ?? '');
      const title = decodeURIComponent(placeholder.dataset['title'] ?? '');

      const ref = createComponent(AuthImageComponent, { environmentInjector: this.injector });
      ref.instance.authSrc = authSrc;
      ref.instance.alt = alt;
      ref.instance.title = title;
      ref.changeDetectorRef.detectChanges();

      placeholder.replaceWith(ref.location.nativeElement);
      this.appRef.attachView(ref.hostView);
      this.componentRefs.push(ref);
    });
  }
}

// ── AuthFilesDirective ────────────────────────────────────────────────────────
// Compatibility shim for raw data-auth-href cards. Safe to remove once all
// file cards go through FileCardComponent / FileCardMountDirective.
@Directive({ selector: '[authFiles]', standalone: true })
export class AuthFilesDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly http = inject(HttpClient);
  private observer: MutationObserver | null = null;

  private static readonly cache = new Map<string, string | Observable<string>>();
  private readonly ownedBlobUrls = new Set<string>();
  private readonly clickListeners = new Map<HTMLElement, (e: MouseEvent) => void>();

  ngOnInit() {
    this.attachListeners(this.el.nativeElement);

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) this.attachListeners(node);
        });
      }
    });
    this.observer.observe(this.el.nativeElement, { childList: true, subtree: true });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.ownedBlobUrls.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
    this.ownedBlobUrls.clear();
    this.clickListeners.forEach((listener, el) => el.removeEventListener('click', listener));
    this.clickListeners.clear();
  }

  private attachListeners(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>('[data-auth-href]').forEach((card) => this.attachCard(card));
  }

  private attachCard(card: HTMLElement) {
    if (this.clickListeners.has(card)) return;

    const src = card.dataset['authHref']!;
    const filename = card.dataset['authFilename'] ?? 'download';

    const cardListener = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-auth-download]')) return;
      e.preventDefault();
      this.fetchBlobUrl(src).subscribe({
        next: (blobUrl) => window.open(blobUrl, '_blank', 'noopener,noreferrer'),
        error: () => console.warn(`[AuthFilesDirective] Failed to open: ${src}`),
      });
    };
    card.addEventListener('click', cardListener);
    this.clickListeners.set(card, cardListener);

    const anchor = card.querySelector<HTMLElement>('[data-auth-download]');
    if (anchor) {
      const dlListener = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.fetchBlobUrl(src).subscribe({
          next: (blobUrl) => {
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            a.click();
          },
          error: () => console.warn(`[AuthFilesDirective] Failed to download: ${src}`),
        });
      };
      anchor.addEventListener('click', dlListener);
      this.clickListeners.set(anchor, dlListener);
    }
  }

  private fetchBlobUrl(src: string): Observable<string> {
    const cached = AuthFilesDirective.cache.get(src);
    if (typeof cached === 'string')
      return new Observable((o) => {
        o.next(cached);
        o.complete();
      });
    if (cached instanceof Observable) return cached;

    const token = localStorage.getItem('jwt_token') ?? '';
    const blobUrl$ = this.http
      .get(src, { responseType: 'blob', headers: { Authorization: `Bearer ${token}` } })
      .pipe(
        map((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          AuthFilesDirective.cache.set(src, blobUrl);
          this.ownedBlobUrls.add(blobUrl);
          return blobUrl;
        }),
        publishReplay(1),
        refCount(),
      );

    AuthFilesDirective.cache.set(src, blobUrl$);
    return blobUrl$;
  }

  static clearCache(): void {
    AuthFilesDirective.cache.forEach((entry) => {
      if (typeof entry === 'string') URL.revokeObjectURL(entry);
    });
    AuthFilesDirective.cache.clear();
  }
}

// ── closeOpenCodeBlocks ───────────────────────────────────────────────────────
export function closeOpenCodeBlocks(text: string): string {
  const lines = text.split('\n');

  let openFenceChar: '`' | '~' | null = null;
  let openFenceLen = 0;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('`') && !trimmed.startsWith('~')) continue;

    const char = trimmed[0] as '`' | '~';
    let len = 0;
    while (trimmed[len] === char) len++;
    if (len < 3) continue;

    if (openFenceChar === null) {
      openFenceChar = char;
      openFenceLen = len;
    } else if (char === openFenceChar && len >= openFenceLen) {
      openFenceChar = null;
      openFenceLen = 0;
    }
  }

  if (openFenceChar === null) return text;

  const closingFence = openFenceChar.repeat(openFenceLen);
  return text.endsWith('\n') ? text + closingFence : text + '\n' + closingFence;
}

