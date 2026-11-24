import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DocumentBookRequest {
    name: string;
    shortName?: string | null;
    standardDays?: number | null;
    parentId?: number | null;
}

export interface DocumentBookResponse {
    id: number;
    name: string;
    shortName: string | null;
    standardDays: number | null;
    parentId: number | null;
    parentName: string | null;
}

@Injectable({ providedIn: 'root' })
export class DocumentBookService {
    private readonly api = '/api/document-books';

    constructor(private http: HttpClient) { }

    findAll(): Observable<DocumentBookResponse[]> {
        return this.http.get<DocumentBookResponse[]>(this.api, { withCredentials: true });
    }

    findById(id: number): Observable<DocumentBookResponse> {
        return this.http.get<DocumentBookResponse>(`${this.api}/${id}`, { withCredentials: true });
    }

    create(req: DocumentBookRequest): Observable<DocumentBookResponse> {
        return this.http.post<DocumentBookResponse>(this.api, req, { withCredentials: true });
    }

    update(id: number, req: DocumentBookRequest): Observable<DocumentBookResponse> {
        return this.http.put<DocumentBookResponse>(`${this.api}/${id}`, req, { withCredentials: true });
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.api}/${id}`, { withCredentials: true });
    }
}