import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  employeeCode: string;
  fullName: string;
  fullNameAr: string;
  username: string;
  email: string;
  profilePhoto?: string;
  preferredLang: string;
  role: { id: number; name: string; nameAr: string; level: number };
  department?: { id: number; name: string; nameAr: string } | null;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'tf_access_token';
  private readonly REFRESH_KEY = 'tf_refresh_token';
  private readonly USER_KEY = 'tf_user';

  currentUser = signal<User | null>(this.loadUser());
  isAuthenticated = signal<boolean>(!!this.getToken());

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string) {
    return this.http.post<any>(`${environment.apiUrl}/auth/login`, { username, password }).pipe(
      tap(res => {
        if (res.success) {
          this.saveSession(res.data.accessToken, res.data.refreshToken, res.data.user);
        }
      })
    );
  }

  logout() {
    this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe();
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }

  refresh() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return throwError(() => new Error('No refresh token'));
    return this.http.post<any>(`${environment.apiUrl}/auth/refresh`, { refreshToken }).pipe(
      tap(res => {
        if (res.success) localStorage.setItem(this.TOKEN_KEY, res.data.accessToken);
      }),
      catchError(err => {
        this.clearSession();
        this.router.navigate(['/auth/login']);
        return throwError(() => err);
      })
    );
  }

  changePassword(oldPassword: string, newPassword: string) {
    return this.http.post(`${environment.apiUrl}/auth/change-password`, { oldPassword, newPassword });
  }

  getProfile() {
    return this.http.get<any>(`${environment.apiUrl}/auth/profile`).pipe(
      tap(res => { if (res.success) { this.currentUser.set(res.data); this.saveUserOnly(res.data); } })
    );
  }

  updateLang(lang: string) {
    const user = this.currentUser();
    if (user) {
      this.currentUser.set({ ...user, preferredLang: lang });
      this.saveUserOnly(this.currentUser()!);
    }
  }

  saveSession(accessToken: string, refreshToken: string, user: User) {
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_KEY, refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
    this.isAuthenticated.set(true);
  }

  saveUserOnly(user: User) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  getToken(): string | null { return localStorage.getItem(this.TOKEN_KEY); }
  getRefreshToken(): string | null { return localStorage.getItem(this.REFRESH_KEY); }
  private loadUser(): User | null {
    const s = localStorage.getItem(this.USER_KEY);
    return s ? JSON.parse(s) : null;
  }

  hasRole(...roles: string[]): boolean {
    return roles.includes(this.currentUser()?.role.name ?? '');
  }

  hasRoleLevel(maxLevel: number): boolean {
    return (this.currentUser()?.role.level ?? 99) <= maxLevel;
  }
}
