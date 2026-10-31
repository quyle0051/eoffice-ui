import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, tap } from 'rxjs';

export interface UserInfo {
    email: string;
    roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly api = 'http://localhost:8080/api/auth';

    readonly user = signal<UserInfo | null>(null);

    constructor(private http: HttpClient) { }

    login(email: string, password: string): Observable<UserInfo> {
        return this.http.post<UserInfo>(
            `${this.api}/login`,
            { email, password },
            { withCredentials: true }
        ).pipe(tap((u) => this.user.set(u)));
    }

    logout(): Observable<unknown> {
        return this.http.post(`${this.api}/logout`, {}, { withCredentials: true }).pipe(finalize(() => this.user.set(null)));
    }

    me(): Observable<UserInfo> {
        return this.http.get<UserInfo>(`${this.api}/me`, { withCredentials: true }).pipe(tap((u) => this.user.set(u)));
    }

    hasAnyRole(roles?: string[]): boolean {
        if (!roles || roles.length === 0) {
            return true;
        }
        const mine = (this.user()?.roles ?? []).map((r) => r.replace('ROLE_', ''));
        return mine.some((r) => roles.includes(r));
    }
}