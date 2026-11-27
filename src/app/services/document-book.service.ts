import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type DocumentBookTypeCode = 'INCOMING' | 'OUTGOING' | 'INTERNAL';

export interface DocumentBookTypeResponse {
    id: number;
    code: DocumentBookTypeCode;
    name: string;
}

export interface DocumentBookRequest {
    name: string;
    shortName?: string | null;
    bookTypeId: number;
    parentId?: number | null;
}

export interface DocumentBookResponse {
    id: number;
    name: string;
    shortName: string | null;
    parentId: number | null;
    parentName: string | null;
    bookTypeId: number;
    bookTypeCode: DocumentBookTypeCode;
    bookTypeName: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentBookService {
    private readonly api = '/api/document-books';
    private readonly typeApi = '/api/document-book-types';

    constructor(private http: HttpClient) { }

    findAll(typeCode?: DocumentBookTypeCode): Observable<DocumentBookResponse[]> {
        let params = new HttpParams();
        if (typeCode) {
            params = params.set('type', typeCode);
        }
        return this.http.get<DocumentBookResponse[]>(this.api, { params, withCredentials: true });
    }

    findTypes(): Observable<DocumentBookTypeResponse[]> {
        return this.http.get<DocumentBookTypeResponse[]>(this.typeApi, { withCredentials: true });
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