import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PageResponse } from './incoming-document.service';

export interface OrganItem {
    id: number;
    organId: string;
    organName: string;
    address?: string;
    email?: string;
}

export interface OutgoingRecipientItem {
    id?: number;
    organId: string;
    organName: string;
    copies: number;
    deliveryMethod: string;
    deliveryStatus?: string;
    sentAt?: string;
    trackingNote?: string;
}

export interface OutgoingDocumentRequest {
    fileOrganId?: string | null;
    fileCatalog?: number | null;
    fileNotation?: string | null;
    docOrdinal?: number | null;
    documentBookId: number;
    documentTypeId: number;
    codeNumber: string;
    codeNotation: string;
    issuedDate: string;
    organName: string;
    subject: string;
    language?: string;
    pageAmount?: number;
    description?: string;
    signerPosition?: string;
    signerFullName?: string;
    recipients: OutgoingRecipientItem[];
    priority: number;
    issuedAmount: number;
    dueDate?: string | null;
    issueImmediately?: boolean;
}

export interface OutgoingDocumentResponse {
    id: number;
    fileCode?: string;
    fileOrganId?: string;
    fileCatalog?: number;
    fileNotation?: string;
    docOrdinal?: number;
    documentBookId: number;
    documentBookName: string;
    documentTypeId: number;
    documentTypeName: string;
    codeNumber: string;
    codeNotation: string;
    issuedDate: string;
    organName: string;
    subject: string;
    language: string;
    pageAmount: number;
    description?: string;
    signerPosition?: string;
    signerFullName?: string;
    toOrgansSummary?: string;
    recipients: OutgoingRecipientItem[];
    priority: number;
    issuedAmount: number;
    dueDate?: string | null;
    issuedTime?: string;
    status: 'REGISTERED' | 'ISSUED' | 'ARCHIVED';
    attachmentName?: string | null;
    createdByName?: string;
    createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class OutgoingDocumentService {
    private readonly api = 'http://localhost:8080/api/outgoing-documents';

    constructor(private http: HttpClient) { }

    search(filters: {
        keyword?: string;
        bookId?: number | null;
        typeId?: number | null;
        status?: string;
        fromDate?: string;
        toDate?: string;
        page?: number;
        size?: number;
    }): Observable<PageResponse<OutgoingDocumentResponse>> {
        let params = new HttpParams()
            .set('page', filters.page ?? 0)
            .set('size', filters.size ?? 10);

        if (filters.keyword?.trim()) params = params.set('keyword', filters.keyword.trim());
        if (filters.bookId) params = params.set('bookId', filters.bookId);
        if (filters.typeId) params = params.set('typeId', filters.typeId);
        if (filters.status) params = params.set('status', filters.status);
        if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
        if (filters.toDate) params = params.set('toDate', filters.toDate);

        return this.http.get<PageResponse<OutgoingDocumentResponse>>(this.api, {
            params,
            withCredentials: true,
        });
    }

    suggestNextNumber(bookId: number, typeId?: number | null): Observable<{ codeNumber: string; codeNotation: string }> {
        let params = new HttpParams().set('bookId', bookId);
        if (typeId) params = params.set('typeId', typeId);
        return this.http.get<{ codeNumber: string; codeNotation: string }>(`${this.api}/next-number`, {
            params,
            withCredentials: true,
        });
    }

    getOrgans(): Observable<OrganItem[]> {
        return this.http.get<OrganItem[]>(`${this.api}/organs`, { withCredentials: true });
    }

    findById(id: number): Observable<OutgoingDocumentResponse> {
        return this.http.get<OutgoingDocumentResponse>(`${this.api}/${id}`, { withCredentials: true });
    }

    create(req: OutgoingDocumentRequest): Observable<OutgoingDocumentResponse> {
        return this.http.post<OutgoingDocumentResponse>(this.api, req, { withCredentials: true });
    }

    update(id: number, req: OutgoingDocumentRequest): Observable<OutgoingDocumentResponse> {
        return this.http.put<OutgoingDocumentResponse>(`${this.api}/${id}`, req, { withCredentials: true });
    }

    uploadAttachment(id: number, file: File): Observable<OutgoingDocumentResponse> {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<OutgoingDocumentResponse>(`${this.api}/${id}/attachment`, fd, {
            withCredentials: true,
        });
    }

    getAttachmentUrl(id: number): string {
        return `${this.api}/${id}/attachment`;
    }

    issue(id: number): Observable<OutgoingDocumentResponse> {
        return this.http.post<OutgoingDocumentResponse>(`${this.api}/${id}/issue`, {}, { withCredentials: true });
    }

    updateRecipientStatus(
        id: number,
        recipientId: number,
        deliveryStatus: string,
        trackingNote: string
    ): Observable<OutgoingDocumentResponse> {
        return this.http.put<OutgoingDocumentResponse>(
            `${this.api}/${id}/recipients/${recipientId}`,
            { deliveryStatus, trackingNote },
            { withCredentials: true }
        );
    }

    archive(id: number): Observable<OutgoingDocumentResponse> {
        return this.http.post<OutgoingDocumentResponse>(`${this.api}/${id}/archive`, {}, { withCredentials: true });
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.api}/${id}`, { withCredentials: true });
    }
}