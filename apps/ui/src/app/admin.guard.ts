import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './client';

/** Only allows navigation for authenticated users with role 'admin'. */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getMe().pipe(
    map((me) => (me.role === 'admin' ? true : router.createUrlTree(['/chat-openai']))),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};
