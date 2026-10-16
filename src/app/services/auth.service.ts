import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserInfo {
    email: string;
    roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly api = 'http://localhost:8080/api/auth';

    constructor(private http: HttpClient) { }

    login(email: string, password: string): Observable<UserInfo> {
        return this.http.post<UserInfo>(
            `${this.api}/login`,
            { email, password },
            { withCredentials: true }
        );
    }

    logout(): Observable<unknown> {
        return this.http.post(`${this.api}/logout`, {}, { withCredentials: true });
    }

    me(): Observable<UserInfo> {
        return this.http.get<UserInfo>(`${this.api}/me`, { withCredentials: true });
    }
}