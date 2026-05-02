import {
  inject,
  Pipe,
  PipeTransform,
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  OnChanges,
  AfterViewChecked,
  input,
  effect,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { marked, type TokenizerExtension, type RendererExtension } from 'marked';
import katex from 'katex';
import Prism from 'prismjs';
import { map, Observable, publishReplay, refCount } from 'rxjs';
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

// ── Code block extension: ```lang ... ``` ────────────────────────────────────
const fencedCodeExtension: TokenizerExtension & RendererExtension = {
  name: 'fencedCode',
  level: 'block',
  start(src: string) {
    return src.indexOf('```');
  },
  tokenizer(src: string) {
    // const match = src.match(/^```(\w*)\n([\s\S]*?)```/);
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
  // ── Fenced code block renderer (Tailwind) ───────────────────────────────────
  renderer(token: any) {
    const lang = token.lang || 'plaintext';
    let highlighted: string;
    try {
      const grammar = Prism.languages[lang] ?? Prism.languages['plaintext'];
      highlighted = Prism.highlight(token.text, grammar, lang);
    } catch {
      highlighted = token.text;
    }
    const id = `code-${Math.random().toString(36).slice(2, 8)}`;
    return `
<div class="my-4 rounded-lg overflow-x-auto border border-code-border bg-code-bg text-[13.5px]">
  <div class="flex items-center justify-between px-3.5 py-1.5 bg-code-header border-b border-code-border">
    <span class="font-mono text-[11px] tracking-wide text-text-muted lowercase">${lang}</span>
    <button
      class="text-[11px] px-2.5 py-0.5 rounded border border-border-default text-text-muted hover:bg-surface-overlay hover:text-text-secondary transition-colors duration-150 cursor-pointer font-sans"
      data-copy-id="${id}"
    >Copy</button>
  </div>
  <pre class="m-0 px-4 py-3.5 overflow-x-auto max-w-full whitespace-pre bg-transparent language-${lang}"><code
    id="${id}"
    class="font-mono text-[13.5px] leading-[1.65] bg-transparent language-${lang} text-code-variable"
    data-raw="${encodeURIComponent(token.text)}"
  >${highlighted}</code></pre>
</div>`;
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

// ── Image renderer: defer auth images via data-auth-src ──────────────────────
// Instead of setting src directly (which would 401), we store the real URL in
// data-auth-src and leave src empty. AuthImagesDirective picks these up and
// replaces src with an authenticated blob URL.
renderer.image = ({ href, title, text }) => {
  if (!href) return '';
  const titleAttr = title ? ` title="${title}"` : '';
  const altAttr = text ? ` alt="${text}"` : '';
  return `<img data-auth-src="${href}"${altAttr}${titleAttr} src="" class="rounded-md max-w-full cursor-pointer transition-all ease-in-out duration-500" />`;
};

// ── File card extension: ::file[name](url){size=X type=Y} ───────────────────
// Renders a styled download card for files returned by MCP tools.
// Usage in MCP response:
//   ::file[a-practical-guide.pdf](https://cdn.example.com/file.pdf){size=3.2MB type=pdf}
const fileCardExtension: TokenizerExtension & RendererExtension = {
  name: 'fileCard',
  level: 'block',
  start(src: string) {
    return src.indexOf('::file[');
  },
  tokenizer(src: string) {
    // ::file[filename](url){size=X type=Y}
    // attrs block {...} is optional
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

    const ext = (attrs['type'] ?? filename.split('.').pop() ?? 'file').toLowerCase();
    const size = attrs['size'] ?? '';

    // ── Pick icon + accent colour based on file type ────────────────────────
    const typeMap: Record<string, { icon: string; colour: string }> = {
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
    };
    const { icon, colour } = typeMap[ext] ?? {
      icon: fileIconGeneric,
      colour: 'var(--color-text-muted)',
    };

    const sizeHtml = size
      ? `<span class="text-[11px] font-medium px-1.5 py-0.5 rounded"
               style="background:var(--color-surface-overlay);color:var(--color-text-muted)"
          >${size}</span>`
      : '';

    const extBadge = `<span class="text-[10px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
        style="background:var(--color-surface-overlay);color:${colour}"
      >${ext}</span>`;

    // data-auth-href / data-auth-filename are picked up by AuthFilesDirective,
    // which fetches with a Bearer token and swaps in a blob URL before the user
    // can interact with the card.
    return `
<div class="group my-3 flex items-center gap-3 rounded-xl px-4 py-3 border transition-all duration-200 cursor-pointer hover-lift"
     style="background:var(--color-surface-raised);border-color:var(--color-border-default);box-shadow:var(--shadow-sm)"
     data-auth-href="${url}"
     data-auth-filename="${filename}"
>
  <!-- File type icon -->
  <div class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
       style="background:var(--color-surface-overlay);color:${colour}">
    ${icon}
  </div>

  <!-- Filename + meta -->
  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[14px] font-medium truncate max-w-[280px]"
            style="color:var(--color-text-primary)"
            title="${filename}">${filename}</span>
      ${extBadge}
      ${sizeHtml}
    </div>
    <p class="text-[11px] mt-0.5 truncate"
       style="color:var(--color-text-muted)">${url}</p>
  </div>

  <!-- Download arrow — href/download injected by AuthFilesDirective once blob is ready -->
  <a data-auth-download
     onclick="event.stopPropagation()"
     title="Download ${filename}"
     class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border opacity-100 transition-all duration-150 hover:scale-105 active:scale-95"
     style="background:var(--color-accent-subtle);border-color:var(--color-accent-text);color:var(--color-accent-text)"
  >
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 1.5v8M4.5 7l3 3 3-3M2.5 11.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </a>
</div>`;
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

// ── closeOpenCodeBlocks ───────────────────────────────────────────────────────
// During streaming the closing ``` of a fenced code block may not have arrived
// yet. The fencedCodeExtension tokenizer won't match an unclosed block, so the
// raw ``` leaks into the output as plain text. This function detects the last
// unclosed fence and appends a matching closing fence so marked always receives
// well-formed input. When all blocks are already closed it returns the original
// string unchanged.
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
    if (len < 3) continue; // not a valid fence

    if (openFenceChar === null) {
      // Opening a new fenced block
      openFenceChar = char;
      openFenceLen = len;
    } else if (char === openFenceChar && len >= openFenceLen) {
      // Valid closing fence — block is now closed
      openFenceChar = null;
      openFenceLen = 0;
    }
    // A different fence character inside an open block is just content
  }

  if (openFenceChar === null) return text; // nothing to fix

  const closingFence = openFenceChar.repeat(openFenceLen);
  return text.endsWith('\n') ? text + closingFence : text + '\n' + closingFence;
}

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

// ── ImageLightbox ─────────────────────────────────────────────────────────────
// A self-contained, singleton lightbox that lives on <body>.
// AuthImagesDirective calls ImageLightbox.open(fullSrcUrl) to display an image.
export class ImageLightbox {
  private static overlay: HTMLElement | null = null;
  private static blobUrl: string | null = null;
  private static ctxMenu: HTMLElement | null = null;
  private static ctxMenuBlobUrl: string | null = null;

  static open(fullUrl: string, http: HttpClient): void {
    // Build the overlay lazily
    if (!this.overlay) {
      this.overlay = this.buildOverlay();
      document.body.appendChild(this.overlay);
    }

    const overlay = this.overlay;
    const img = overlay.querySelector<HTMLImageElement>('.lightbox-img')!;
    const spinner = overlay.querySelector<HTMLElement>('.lightbox-spinner')!;
    const errorMsg = overlay.querySelector<HTMLElement>('.lightbox-error')!;

    // Reset state
    img.src = '';
    img.style.opacity = '0';
    spinner.style.display = 'flex';
    errorMsg.style.display = 'none';
    overlay.style.display = 'flex';

    // Revoke previous blob to free memory
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }

    // Strip thumbnail param and fetch full image
    const url = new URL(fullUrl, window.location.origin);
    url.searchParams.delete('thumbnail');

    const token = localStorage.getItem('jwt_token') ?? '';

    http
      .get(url.toString(), {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (blob) => {
          const blobUrl = URL.createObjectURL(blob);
          this.blobUrl = blobUrl;
          img.src = blobUrl;
          img.onload = () => {
            spinner.style.display = 'none';
            img.style.opacity = '1';
            // Store the current full-res blob URL for context-menu download
            ImageLightbox.ctxMenuBlobUrl = blobUrl;
          };
        },
        error: () => {
          spinner.style.display = 'none';
          errorMsg.style.display = 'flex';
        },
      });
  }

  static close(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    ImageLightbox.closeCtxMenu();
    this.ctxMenuBlobUrl = null;
  }

  /**
   * Show the context menu for any image element — used by both the lightbox
   * image and by AuthImagesDirective for inline auth images.
   */
  static showCtxMenu(blobUrl: string, clientX: number, clientY: number): void {
    this.ctxMenuBlobUrl = blobUrl;
    this.closeCtxMenu();
    this.ctxMenu = this.buildCtxMenu(clientX, clientY);
    document.body.appendChild(this.ctxMenu);
  }

  private static closeCtxMenu(): void {
    if (this.ctxMenu) {
      this.ctxMenu.remove();
      this.ctxMenu = null;
    }
  }

  private static buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'auth-image-lightbox-overlay';
    overlay.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      animation: lightbox-fade-in 0.2s ease;
    `;

    // Inject keyframe animation once
    if (!document.getElementById('lightbox-styles')) {
      const style = document.createElement('style');
      style.id = 'lightbox-styles';
      style.textContent = `
        @keyframes lightbox-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes lightbox-scale-in {
          from { transform: scale(0.93); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .auth-image-lightbox-overlay .lightbox-img {
          transition: opacity 0.2s ease;
          animation: lightbox-scale-in 0.25s ease;
        }
        .auth-image-lightbox-overlay .lightbox-close:hover {
          background: rgba(255,255,255,0.2) !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'lightbox-close';
    closeBtn.innerHTML = '✕';
    closeBtn.setAttribute('aria-label', 'Close image');
    closeBtn.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: rgba(255,255,255,0.12);
      color: #fff;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
      z-index: 1;
    `;
    closeBtn.addEventListener('click', () => ImageLightbox.close());

    // Spinner
    const spinner = document.createElement('div');
    spinner.className = 'lightbox-spinner';
    spinner.style.cssText = `
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255,255,255,0.7);
      font-size: 14px;
      gap: 10px;
    `;
    spinner.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style="animation: spin 0.8s linear infinite;">
        <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
        <path d="M14 3 A11 11 0 0 1 25 14" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      </svg>
      <span>Loading full image…</span>
    `;

    // Error message
    const errorMsg = document.createElement('div');
    errorMsg.className = 'lightbox-error';
    errorMsg.style.cssText = `
      display: none;
      align-items: center;
      gap: 8px;
      color: rgba(255, 120, 120, 0.9);
      font-size: 14px;
    `;
    errorMsg.innerHTML = `<span>⚠</span><span>Failed to load full image.</span>`;

    // Image element
    const img = document.createElement('img');
    img.className = 'lightbox-img';
    img.style.cssText = `
      max-width: 100%;
      max-height: calc(100vh - 48px);
      border-radius: 8px;
      object-fit: contain;
      box-shadow: 0 24px 80px rgba(0,0,0,0.6);
      opacity: 0;
      display: block;
    `;

    // Click on backdrop closes
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) ImageLightbox.close();
    });

    // Right-click on the image → show download context menu
    img.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      ImageLightbox.closeCtxMenu();
      ImageLightbox.ctxMenu = ImageLightbox.buildCtxMenu(e.clientX, e.clientY);
      document.body.appendChild(ImageLightbox.ctxMenu);
    });

    // Left-click anywhere outside the context menu closes it
    overlay.addEventListener('mousedown', () => {
      ImageLightbox.closeCtxMenu();
    });

    // Escape key closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') ImageLightbox.close();
    });

    overlay.appendChild(closeBtn);
    overlay.appendChild(spinner);
    overlay.appendChild(errorMsg);
    overlay.appendChild(img);

    return overlay;
  }

  private static buildCtxMenu(clientX: number, clientY: number): HTMLElement {
    // Inject context-menu styles once
    if (!document.getElementById('lightbox-ctx-styles')) {
      const style = document.createElement('style');
      style.id = 'lightbox-ctx-styles';
      style.textContent = `
        .lightbox-ctx-menu {
          position: fixed;
          z-index: 10000;
          width: 208px;
          background: var(--color-surface-raised, #1c1c1e);
          border: 1px solid var(--color-border-default, rgba(255,255,255,0.1));
          border-radius: 12px;
          overflow: hidden;
          padding: 4px 0;
          box-shadow: var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.7));
          animation: ctx-fade-in 0.12s ease;
        }
        @keyframes ctx-fade-in {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .lightbox-ctx-menu .ctx-header {
          padding: 6px 12px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--color-text-muted, rgba(255,255,255,0.4));
          border-bottom: 1px solid var(--color-border-default, rgba(255,255,255,0.08));
        }
        .lightbox-ctx-menu .ctx-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 12px;
          font-size: 12px;
          color: var(--color-text-secondary, rgba(255,255,255,0.65));
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .lightbox-ctx-menu .ctx-btn:hover {
          background: var(--color-surface-overlay, rgba(255,255,255,0.07));
          color: var(--color-text-primary, #fff);
        }
        .lightbox-ctx-menu .ctx-btn svg {
          flex-shrink: 0;
          opacity: 0.6;
        }
      `;
      document.head.appendChild(style);
    }

    const menu = document.createElement('div');
    menu.className = 'lightbox-ctx-menu';

    // Position — keep inside viewport
    const menuW = 208,
      menuH = 72;
    const x = Math.min(clientX, window.innerWidth - menuW - 8);
    const y = Math.min(clientY, window.innerHeight - menuH - 8);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Header label
    const header = document.createElement('div');
    header.className = 'ctx-header';
    header.textContent = 'Image';
    menu.appendChild(header);

    // ── Download image ──────────────────────────────────────────────────────
    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'ctx-btn';
    downloadBtn.innerHTML = `
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 3v12" />
      </svg>
      Download image
    `;
    downloadBtn.addEventListener('click', () => {
      const blobUrl = ImageLightbox.ctxMenuBlobUrl;
      if (!blobUrl) return;
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'image';
      a.click();
      ImageLightbox.closeCtxMenu();
    });
    menu.appendChild(downloadBtn);

    // Clicking outside closes the menu
    const outsideClick = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        ImageLightbox.closeCtxMenu();
        document.removeEventListener('mousedown', outsideClick);
      }
    };
    // Use setTimeout so this listener doesn't fire for the same click that opened the menu
    setTimeout(() => document.addEventListener('mousedown', outsideClick), 0);

    // Escape key closes
    const escClose = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        ImageLightbox.closeCtxMenu();
        document.removeEventListener('keydown', escClose);
      }
    };
    document.addEventListener('keydown', escClose);

    return menu;
  }
}
// ── AuthImagesDirective ───────────────────────────────────────────────────────
// Apply to any element that contains markdown-rendered HTML.
// It watches for new <img data-auth-src="..."> elements (including during
// streaming) and fetches them with the Authorization header, swapping in a
// blob URL so the browser can display them.
// Blob URLs are cached statically across all directive instances so the same
// remote image is only ever fetched once per page session.
// Clicking a loaded image opens ImageLightbox with the full (non-thumbnail) URL.
@Directive({ selector: '[authImages]', standalone: true })
export class AuthImagesDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly http = inject(HttpClient);
  private observer: MutationObserver | null = null;

  // ── Static cross-instance cache ──────────────────────────────────────────
  // Maps remote URL → resolved blob URL (or in-flight Observable while
  // the request is pending, so concurrent calls share one HTTP request).
  private static readonly cache = new Map<string, string | Observable<string>>();

  private readonly ownedBlobUrls = new Set<string>(); // only URLs created by THIS instance
  private readonly clickListeners = new Map<HTMLImageElement, () => void>();
  private readonly ctxMenuListeners = new Map<HTMLImageElement, (e: MouseEvent) => void>();

  ngOnInit() {
    this.processImages(this.el.nativeElement);

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) this.processImages(node);
        });
        if (
          mutation.type === 'attributes' &&
          mutation.target instanceof HTMLImageElement &&
          (mutation.target as HTMLImageElement).dataset['authSrc']
        ) {
          this.loadImage(mutation.target as HTMLImageElement);
        }
      }
    });

    this.observer.observe(this.el.nativeElement, { childList: true, subtree: true });
  }

  ngOnDestroy() {
    this.observer?.disconnect();

    // Only revoke blob URLs that were created by this instance and are no
    // longer referenced by any other live directive (i.e. not in the cache).
    // We leave cache entries intact so sibling/future instances can still use them.
    this.ownedBlobUrls.forEach((blobUrl) => {
      const stillCached = [...AuthImagesDirective.cache.values()].includes(blobUrl);
      if (!stillCached) URL.revokeObjectURL(blobUrl);
    });
    this.ownedBlobUrls.clear();

    this.clickListeners.forEach((listener, img) => img.removeEventListener('click', listener));
    this.clickListeners.clear();
    this.ctxMenuListeners.forEach((listener, img) =>
      img.removeEventListener('contextmenu', listener),
    );
    this.ctxMenuListeners.clear();
  }

  // ── Cache management ─────────────────────────────────────────────────────

  /** Returns a cached blob URL if available, otherwise undefined. */
  private getCached(src: string): string | undefined {
    const entry = AuthImagesDirective.cache.get(src);
    return typeof entry === 'string' ? entry : undefined;
  }

  /** Stores the resolved blob URL and replaces any in-flight Observable entry. */
  private setCached(src: string, blobUrl: string): void {
    AuthImagesDirective.cache.set(src, blobUrl);
  }

  /** Stores or retrieves the shared in-flight Observable for a pending request. */
  private getOrSetInflight(src: string, factory: () => Observable<string>): Observable<string> {
    const entry = AuthImagesDirective.cache.get(src);
    if (entry instanceof Observable) return entry;
    const inflight$ = factory();
    AuthImagesDirective.cache.set(src, inflight$);
    return inflight$;
  }

  // ── Image loading ─────────────────────────────────────────────────────────

  private processImages(root: HTMLElement) {
    root
      .querySelectorAll<HTMLImageElement>('img[data-auth-src]')
      .forEach((img) => this.loadImage(img));
  }

  private loadImage(img: HTMLImageElement) {
    const src = img.dataset['authSrc'];
    if (!src || img.src.startsWith('blob:')) return;

    // ── Cache hit: apply immediately, no HTTP request ─────────────────────
    const cached = this.getCached(src);
    if (cached) {
      this.applyBlobUrl(img, src, cached);
      return;
    }

    // ── In-flight or new request ──────────────────────────────────────────
    img.setAttribute('loading', 'true');

    const token = localStorage.getItem('jwt_token') ?? '';

    const blobUrl$ = this.getOrSetInflight(src, () =>
      this.http
        .get(src, {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${token}` },
        })
        .pipe(
          map((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            this.setCached(src, blobUrl);
            return blobUrl;
          }),
          // Share the single HTTP request among all concurrent subscribers.
          // publishReplay(1) + refCount() keeps the result cached in the
          // Observable layer until the static Map is populated.
          publishReplay(1),
          refCount(),
        ),
    );

    blobUrl$.subscribe({
      next: (blobUrl) => {
        this.ownedBlobUrls.add(blobUrl);
        img.removeAttribute('loading');
        this.applyBlobUrl(img, src, blobUrl);
      },
      error: () => {
        // Remove the failed entry so a future load can retry.
        AuthImagesDirective.cache.delete(src);
        img.removeAttribute('loading');
        img.alt = `Failed to load image: ${src}`;
      },
    });
  }

  /** Sets img.src and attaches interaction listeners. */
  private applyBlobUrl(img: HTMLImageElement, authSrc: string, blobUrl: string) {
    img.src = blobUrl;

    if (!this.clickListeners.has(img)) {
      const listener = () => ImageLightbox.open(authSrc, this.http);
      img.addEventListener('click', listener);
      this.clickListeners.set(img, listener);
    }

    if (!this.ctxMenuListeners.has(img)) {
      const ctxListener = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const currentBlobUrl = img.src.startsWith('blob:') ? img.src : null;
        if (currentBlobUrl) ImageLightbox.showCtxMenu(currentBlobUrl, e.clientX, e.clientY);
      };
      img.addEventListener('contextmenu', ctxListener);
      this.ctxMenuListeners.set(img, ctxListener);
    }
  }

  // ── Public utility ────────────────────────────────────────────────────────

  /** Call this (e.g. on logout) to purge all cached blob URLs from memory. */
  static clearCache(): void {
    AuthImagesDirective.cache.forEach((entry) => {
      if (typeof entry === 'string') URL.revokeObjectURL(entry);
    });
    AuthImagesDirective.cache.clear();
  }
}

// ── AuthFilesDirective ────────────────────────────────────────────────────────
// Apply to any element that contains markdown-rendered HTML (same host element
// as authImages). Watches for file cards rendered by fileCardExtension:
//
//   <div data-auth-href="api/assets/…" data-auth-filename="report.pdf">
//     …
//     <a data-auth-download>…</a>   ← download button inside the card
//   </div>
//
// For each card it fetches the file with a Bearer token, creates a blob URL,
// then wires up:
//   • card  onclick → window.open(blobUrl)
//   • <a>   href + download → blobUrl / filename  (makes the button functional)
//
// Blob URLs are cached statically across all directive instances (same strategy
// as AuthImagesDirective) so large files are only fetched once per session.
@Directive({ selector: '[authFiles]', standalone: true })
export class AuthFilesDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly http = inject(HttpClient);
  private observer: MutationObserver | null = null;

  // Maps remote URL → resolved blob URL or in-flight Observable
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

  // ── Listener attachment ──────────────────────────────────────────────────
  // Called once per card, on render and on DOM mutations. Does NOT fetch —
  // just registers click handlers that will fetch lazily when the user acts.

  private attachListeners(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>('[data-auth-href]').forEach((card) => this.attachCard(card));
  }

  private attachCard(card: HTMLElement) {
    if (this.clickListeners.has(card)) return; // already wired up

    const src = card.dataset['authHref']!;
    const filename = card.dataset['authFilename'] ?? 'download';

    // Card body click → open/view
    const cardListener = (e: MouseEvent) => {
      // Let the download button's own listener handle its click
      if ((e.target as HTMLElement).closest('[data-auth-download]')) return;
      e.preventDefault();
      this.fetchBlobUrl(src).subscribe({
        next: (blobUrl) => window.open(blobUrl, '_blank', 'noopener,noreferrer'),
        error: () => console.warn(`[AuthFilesDirective] Failed to open: ${src}`),
      });
    };
    card.addEventListener('click', cardListener);
    this.clickListeners.set(card, cardListener);

    // Download button click → fetch then trigger save
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

  // ── Fetch helper — cached, deduped ───────────────────────────────────────

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
      .get(src, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      })
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

  /** Call on logout to purge all cached file blob URLs. */
  static clearCache(): void {
    AuthFilesDirective.cache.forEach((entry) => {
      if (typeof entry === 'string') URL.revokeObjectURL(entry);
    });
    AuthFilesDirective.cache.clear();
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
