import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type AdminRole = 'admin' | 'user';
export type AdminSubscription = 'free' | 'basic';

export interface AdminUser {
  _id: string;
  username: string;
  role: AdminRole;
  subscription: AdminSubscription;
  isActivated: boolean;
  usedTokens: number;
  tokenCountResetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminUserPayload {
  username: string;
  password: string;
  role?: AdminRole;
  subscription?: AdminSubscription;
  isActivated?: boolean;
}

export interface UpdateAdminUserPayload {
  password?: string;
  role?: AdminRole;
  subscription?: AdminSubscription;
  isActivated?: boolean;
}

export interface TokenLimitConfig {
  _id: string;
  subscription: AdminSubscription;
  tokensPerInterval: number;
  minutesTillReset: number;
}

export interface TokenLimitConfigPayload {
  subscription: AdminSubscription;
  tokensPerInterval: number;
  minutesTillReset: number;
}

/**
 * Hand-written client for the admin-only backend endpoints — these aren't
 * part of the OpenAPI-generated client (see apps/ui/src/app/client).
 * Auth headers are attached automatically by authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  // ── Users ───────────────────────────────────────────────────────────────

  listUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>('api/admin/users');
  }

  createUser(payload: CreateAdminUserPayload): Observable<AdminUser> {
    return this.http.post<AdminUser>('api/admin/users', payload);
  }

  updateUser(id: string, payload: UpdateAdminUserPayload): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`api/admin/users/${id}`, payload);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`api/admin/users/${id}`);
  }

  resetUserTokens(id: string): Observable<AdminUser> {
    return this.http.post<AdminUser>(`api/admin/users/${id}/reset-tokens`, {});
  }

  // ── Token limit configs ─────────────────────────────────────────────────

  listTokenLimitConfigs(): Observable<TokenLimitConfig[]> {
    return this.http.get<TokenLimitConfig[]>('api/token-limit-configs');
  }

  createTokenLimitConfig(payload: TokenLimitConfigPayload): Observable<TokenLimitConfig> {
    return this.http.post<TokenLimitConfig>('api/token-limit-configs', payload);
  }

  updateTokenLimitConfig(
    id: string,
    payload: Partial<TokenLimitConfigPayload>,
  ): Observable<TokenLimitConfig> {
    return this.http.put<TokenLimitConfig>(`api/token-limit-configs/${id}`, payload);
  }

  deleteTokenLimitConfig(id: string): Observable<void> {
    return this.http.delete<void>(`api/token-limit-configs/${id}`);
  }
}
