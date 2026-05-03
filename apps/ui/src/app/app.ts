import { ApplicationRef, Component, EnvironmentInjector, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { ImageLightboxComponent } from './routes/lm-studio-api/markdown.pipe';

interface DecodedToken {
  exp: number; // Expiration time in seconds since epoch
  iat: number; // Issued at time
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule, RouterOutlet],
  template: `
    <div
      class=" hidden my-4 rounded-lg overflow-hidden border border-code-border bg-code-bg text-[13.5px]"
    >
      <div
        class="flex items-center justify-between px-3.5 py-1.5 bg-code-header border-b border-code-border"
      >
        <span class="font-mono text-[11px] tracking-wide text-text-muted lowercase"></span>
        <button
          class="text-[11px] px-2.5 py-0.5 rounded border border-border-default text-text-muted hover:bg-surface-overlay hover:text-text-secondary transition-colors duration-150 cursor-pointer font-sans"
        >
          Copy
        </button>
      </div>
      <pre class="m-0 px-4 py-3.5 overflow-x-auto bg-transparent language-ts"><code
        class="font-mono text-[13.5px] leading-[1.65] bg-transparent language-ts text-code-variable"
      ></code></pre>
    </div>
    <router-outlet></router-outlet>
  `,
  styles: [],
})
export class App implements OnInit {
  activatedRoute = inject(ActivatedRoute);
  router = inject(Router);

  constructor(appRef: ApplicationRef, injector: EnvironmentInjector) {
    ImageLightboxComponent.bootstrap(appRef, injector);
  }

  ngOnInit() {
    // Replace your delegated click listener with this safe version
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-id]');
      if (!btn) return;

      const id = btn.dataset['copyId']!;
      const codeEl = document.getElementById(id);
      if (!codeEl) return;

      const raw = decodeURIComponent(codeEl.dataset['raw'] ?? '');

      const apply = (ok: boolean) => {
        btn.textContent = ok ? 'Copied!' : 'Failed';
        btn.style.color = ok ? 'var(--color-success-text)' : 'var(--color-error-text)';
        btn.style.borderColor = ok ? 'var(--color-success-border)' : 'var(--color-error-border)';
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.style.color = '';
          btn.style.borderColor = '';
        }, 2000);
      };

      // Clipboard API (requires HTTPS or localhost)
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(raw)
          .then(() => apply(true))
          .catch(() => apply(false));
        return;
      }

      // Fallback: temp textarea + execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = raw;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        apply(ok);
      } catch {
        apply(false);
      }
    });
    const currentRoute = this.activatedRoute.snapshot.url.map((segment) => segment.path).join('/');
    if (currentRoute.includes('login') || currentRoute.includes('readme') || currentRoute === '')
      return;

    const token = localStorage.getItem('jwt_token');
    if (!token || this.isTokenExpired(token)) {
      return this.router.navigate(['login']);
    }
    return;
  }

  decodeToken(token: string): DecodedToken | null {
    try {
      return jwtDecode<DecodedToken>(token);
    } catch (Error) {
      console.error('Error decoding token:', Error);
      return null;
    }
  }

  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      // If token is invalid or has no expiration, treat as expired/invalid
      return true;
    }
    const currentTime = Date.now() / 1000; // Current time in seconds
    return decoded.exp < currentTime;
  }
}
