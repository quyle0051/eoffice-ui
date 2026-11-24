import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DocumentTypeResponse {
    id: number;
    name: string;
    abbreviation: string;
    category: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentTypeService {
    private readonly api = '/api/document-types';

    constructor(private http: HttpClient) { }

    findAll(): Observable<DocumentTypeResponse[]> {
        return this.http.get<DocumentTypeResponse[]>(this.api, { withCredentials: true });
    }
}