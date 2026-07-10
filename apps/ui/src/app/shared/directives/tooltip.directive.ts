import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  Renderer2,
} from '@angular/core';

/**
 * Lightweight tooltip directive matching the app's surface/accent design language.
 * Usage: <div [uiTooltip]="'Some text'" uiTooltipPosition="top">…</div>
 */
@Directive({
  selector: '[uiTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  readonly uiTooltip = input<string | null | undefined>();
  readonly uiTooltipPosition = input<'top' | 'bottom' | 'left' | 'right'>('top');

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  private tooltipEl?: HTMLElement;
  private arrowEl?: HTMLElement;
  private showTimeout?: ReturnType<typeof setTimeout>;

  @HostListener('mouseenter')
  onEnter(): void {
    const text = this.uiTooltip();
    if (!text) return;
    this.showTimeout = setTimeout(() => this.show(text), 300);
  }

  @HostListener('mouseleave')
  @HostListener('click')
  onLeave(): void {
    clearTimeout(this.showTimeout);
    this.destroyTooltip();
  }

  private show(text: string): void {
    this.destroyTooltip();

    const tooltip = this.renderer.createElement('div') as HTMLElement;
    tooltip.textContent = text;
    this.renderer.setAttribute(tooltip, 'role', 'tooltip');
    this.renderer.setAttribute(
      tooltip,
      'style',
      [
        'position: fixed',
        'z-index: 9999',
        'pointer-events: none',
        'max-width: 320px',
        'padding: 6px 10px',
        'border-radius: 8px',
        'font-size: 11px',
        'font-weight: 500',
        'line-height: 1.4',
        'letter-spacing: 0.01em',
        'white-space: pre-line',
        'word-break: break-word',
        'background: var(--color-surface-overlay)',
        'color: var(--color-text-primary)',
        'border: 1px solid var(--color-border-default)',
        'box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.25))',
        'opacity: 0',
        'transform: scale(0.94) translateY(2px)',
        'transform-origin: center bottom',
        'transition: opacity 120ms cubic-bezier(0.16,1,0.3,1), transform 120ms cubic-bezier(0.16,1,0.3,1)',
      ].join(';'),
    );

    const arrow = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setAttribute(
      arrow,
      'style',
      [
        'position: absolute',
        'width: 8px',
        'height: 8px',
        'background: var(--color-surface-overlay)',
        'border-right: 1px solid var(--color-border-default)',
        'border-bottom: 1px solid var(--color-border-default)',
        'transform: rotate(45deg)',
      ].join(';'),
    );
    this.renderer.appendChild(tooltip, arrow);
    this.renderer.appendChild(document.body, tooltip);

    this.tooltipEl = tooltip;
    this.arrowEl = arrow;

    this.position();

    requestAnimationFrame(() => {
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'scale(1) translateY(0)';
    });
  }

  private position(): void {
    if (!this.tooltipEl) return;
    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const tipRect = this.tooltipEl.getBoundingClientRect();
    const gap = 8;
    const pos = this.uiTooltipPosition();

    let top = 0;
    let left = 0;
    let arrowTop = '';
    let arrowLeft = '';
    let arrowTransform = 'rotate(45deg)';

    switch (pos) {
      case 'bottom':
        top = hostRect.bottom + gap;
        left = hostRect.left + hostRect.width / 2 - tipRect.width / 2;
        arrowTop = '-4px';
        arrowLeft = `${tipRect.width / 2 - 4}px`;
        arrowTransform = 'rotate(225deg)';
        break;
      case 'left':
        top = hostRect.top + hostRect.height / 2 - tipRect.height / 2;
        left = hostRect.left - tipRect.width - gap;
        arrowTop = `${tipRect.height / 2 - 4}px`;
        arrowLeft = `${tipRect.width - 4}px`;
        arrowTransform = 'rotate(-45deg)';
        break;
      case 'right':
        top = hostRect.top + hostRect.height / 2 - tipRect.height / 2;
        left = hostRect.right + gap;
        arrowTop = `${tipRect.height / 2 - 4}px`;
        arrowLeft = '-4px';
        arrowTransform = 'rotate(135deg)';
        break;
      case 'top':
      default:
        top = hostRect.top - tipRect.height - gap;
        left = hostRect.left + hostRect.width / 2 - tipRect.width / 2;
        arrowTop = `${tipRect.height - 4}px`;
        arrowLeft = `${tipRect.width / 2 - 4}px`;
        arrowTransform = 'rotate(45deg)';
        break;
    }

    left = Math.max(6, Math.min(left, window.innerWidth - tipRect.width - 6));
    top = Math.max(6, Math.min(top, window.innerHeight - tipRect.height - 6));

    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.left = `${left}px`;
    if (this.arrowEl) {
      this.arrowEl.style.top = arrowTop;
      this.arrowEl.style.left = arrowLeft;
      this.arrowEl.style.transform = arrowTransform;
    }
  }

  private destroyTooltip(): void {
    this.tooltipEl?.remove();
    this.tooltipEl = undefined;
    this.arrowEl = undefined;
  }

  ngOnDestroy(): void {
    clearTimeout(this.showTimeout);
    this.destroyTooltip();
  }
}
