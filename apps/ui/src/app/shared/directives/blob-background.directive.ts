import {
  Directive,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  inject,
  PLATFORM_ID,
  Renderer2,
  Input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface Blob {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  color: string;
  phase: number;
  freq: number;
}

const BLOBS_LIGHT: string[] = [
  'rgba(91,79,233,0.18)',
  'rgba(91,79,233,0.12)',
  'rgba(13,148,136,0.16)',
  'rgba(13,148,136,0.10)',
  'rgba(217,119,6,0.14)',
  'rgba(37,99,235,0.12)',
  'rgba(91,79,233,0.09)',
];

const BLOBS_DARK: string[] = [
  'rgba(109,98,212,0.22)',
  'rgba(109,98,212,0.14)',
  'rgba(91,143,185,0.18)',
  'rgba(91,143,185,0.12)',
  'rgba(194,137,10,0.16)',
  'rgba(109,98,212,0.10)',
  'rgba(91,143,185,0.09)',
];

@Directive({
  selector: '[appBlobBackground]',
  standalone: true,
})
export class BlobBackgroundDirective implements AfterViewInit, OnDestroy {
  /** Blur strength in px — default 64 */
  @Input() blobBlur = 64;
  /** Override blob count — defaults to palette length (7) */
  @Input() blobCount?: number;

  private el = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);
  private platformId = inject(PLATFORM_ID);

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private blobs: Blob[] = [];
  private animationId!: number;
  private tick = 0;
  private observer!: MutationObserver;
  private resizeObserver!: ResizeObserver;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.setupHost();
    this.createCanvas();
    this.initBlobs();
    this.draw();
    this.watchTheme();
    this.watchSize();
  }

  /** Ensure the host element is a valid positioning context */
  private setupHost(): void {
    const host: HTMLElement = this.el.nativeElement;
    const pos = getComputedStyle(host).position;
    if (pos === 'static') {
      this.renderer.setStyle(host, 'position', 'relative');
    }
  }

  private createCanvas(): void {
    const host: HTMLElement = this.el.nativeElement;

    this.canvas = this.renderer.createElement('canvas') as HTMLCanvasElement;

    // Position behind all host children
    this.renderer.setStyle(this.canvas, 'position', 'absolute');
    this.renderer.setStyle(this.canvas, 'inset', '0');
    this.renderer.setStyle(this.canvas, 'width', '100%');
    this.renderer.setStyle(this.canvas, 'height', '100%');
    this.renderer.setStyle(this.canvas, 'filter', `blur(${this.blobBlur}px)`);
    // z-index -1 keeps it behind all host content
    this.renderer.setStyle(this.canvas, 'z-index', '0');
    this.renderer.setStyle(this.canvas, 'pointer-events', 'none');

    // Insert as the very first child so natural stacking puts it behind
    if (host.firstChild) {
      this.renderer.insertBefore(host, this.canvas, host.firstChild);
    } else {
      this.renderer.appendChild(host, this.canvas);
    }

    // Ensure existing children stack above the canvas
    Array.from(host.children).forEach((child) => {
      if (child !== this.canvas) {
        //this.renderer.setStyle(child, 'position', 'relative');
        // this.renderer.setStyle(child, 'z-index', '1');
      }
    });

    this.syncSize();
    this.ctx = this.canvas.getContext('2d')!;
  }

  private syncSize(): void {
    const host: HTMLElement = this.el.nativeElement;
    this.canvas.width = host.offsetWidth;
    this.canvas.height = host.offsetHeight;
  }

  private isDark(): boolean {
    return document.documentElement.classList.contains('dark');
  }

  private palette(): string[] {
    const base = this.isDark() ? BLOBS_DARK : BLOBS_LIGHT;
    const count = this.blobCount ?? base.length;
    // cycle through palette if count > palette length
    return Array.from({ length: count }, (_, i) => base[i % base.length]);
  }

  private initBlobs(): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.blobs = this.palette().map((color) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.max(W, H) * (0.15 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      color,
      phase: Math.random() * Math.PI * 2,
      freq: 0.0004 + Math.random() * 0.0004,
    }));
  }

  private updateColors(): void {
    const p = this.palette();
    this.blobs.forEach((b, i) => (b.color = p[i % p.length]));
  }

  private draw = (): void => {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    this.tick++;

    for (const b of this.blobs) {
      b.x += b.vx + Math.sin(this.tick * b.freq + b.phase) * 0.4;
      b.y += b.vy + Math.cos(this.tick * b.freq + b.phase * 1.3) * 0.4;

      if (b.x < -b.r) b.x = W + b.r;
      if (b.x > W + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = H + b.r;
      if (b.y > H + b.r) b.y = -b.r;

      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }

    this.animationId = requestAnimationFrame(this.draw);
  };

  private watchTheme(): void {
    this.observer = new MutationObserver(() => this.updateColors());
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private watchSize(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.syncSize();
      // rescale blob radii to new dimensions
      const W = this.canvas.width;
      const H = this.canvas.height;
      this.blobs.forEach((b) => {
        b.r = Math.max(W, H) * (0.15 + Math.random() * 0.25);
      });
    });
    this.resizeObserver.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    this.canvas?.remove();
  }
}
