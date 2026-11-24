import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PageResponse } from './incoming-document.service';

export type InternalDocumentStatus = 'REGISTERED' | 'ISSUED' | 'ARCHIVED';

/** Số văn bản, cơ quan ban hành và nơi nhận do hệ thống tự điền nên không có trong request. */
export interface InternalDocumentRequest {
    documentBookId: number;
    documentTypeId: number;
    codeNotation: string;
    issuedDate: string;
    subject: string;
    language?: string | null;
    pageAmount?: number | null;
    description?: string | null;
    signerPosition?: string | null;
    signerFullName?: string | null;
    priority: number;
    issuedAmount: number;
    dueDate?: string | null;
    issueImmediately?: boolean;
}

export interface InternalDocumentResponse {
    id: number;
    documentBookId: number;
    documentBookName: string;
    documentTypeId: number;
    documentTypeName: string;
    documentTypeAbbreviation?: string | null;
    serialNumber: number;
    codeNumber: string;
    codeNotation: string;
    issuedDate: string;
    organName: string;
    toPlaces?: string | null;
    subject: string;
    language?: string | null;
    pageAmount?: number | null;
    description?: string | null;
    signerPosition?: string | null;
    signerFullName?: string | null;
    priority: number;
    issuedAmount: number;
    dueDate?: string | null;
    issuedTime?: string | null;
    status: InternalDocumentStatus;
    attachmentName?: string | null;
    createdByName?: string | null;
    createdAt: string;
}

export interface InternalNextInfo {
    codeNumber: string;
    codeNotation: string;
    organName: string;
}

export interface InternalSearchFilters {
    keyword?: string;
    bookId?: number | null;
    typeId?: number | null;
    status?: string;
    fromDate?: string;
    toDate?: string;
    priority?: number | null;
    signer?: string;
    dueFrom?: string;
    dueTo?: string;
    overdue?: boolean;
    hasAttachment?: boolean;
    page?: number;
    size?: number;
}

@Injectable({ providedIn: 'root' })
export class InternalDocumentService {
    private readonly api = '/api/internal-documents';

    constructor(private http: HttpClient) { }

    search(filters: InternalSearchFilters): Observable<PageResponse<InternalDocumentResponse>> {
        let params = new HttpParams()
            .set('page', filters.page ?? 0)
            .set('size', filters.size ?? 10);

        if (filters.keyword?.trim()) params = params.set('keyword', filters.keyword.trim());
        if (filters.bookId) params = params.set('bookId', filters.bookId);
        if (filters.typeId) params = params.set('typeId', filters.typeId);
        if (filters.status) params = params.set('status', filters.status);
        if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
        if (filters.toDate) params = params.set('toDate', filters.toDate);
        if (filters.priority !== null && filters.priority !== undefined) params = params.set('priority', filters.priority);
        if (filters.signer?.trim()) params = params.set('signer', filters.signer.trim());
        if (filters.dueFrom) params = params.set('dueFrom', filters.dueFrom);
        if (filters.dueTo) params = params.set('dueTo', filters.dueTo);
        if (filters.overdue) params = params.set('overdue', 'true');
        if (filters.hasAttachment) params = params.set('hasAttachment', 'true');

        return this.http.get<PageResponse<InternalDocumentResponse>>(this.api, {
            params,
            withCredentials: true,
        });
    }

    /** Gợi ý số văn bản, ký hiệu và tên cơ quan hiện tại khi chọn sổ và loại văn bản. */
    nextInfo(
        bookId: number | null,
        typeId: number | null,
        issuedDate: string | null
    ): Observable<InternalNextInfo> {
        let params = new HttpParams();
        if (bookId) params = params.set('bookId', bookId);
        if (typeId) params = params.set('typeId', typeId);
        if (issuedDate) params = params.set('issuedDate', issuedDate);
        return this.http.get<InternalNextInfo>(`${this.api}/next-info`, {
            params,
            withCredentials: true,
        });
    }

    findById(id: number): Observable<InternalDocumentResponse> {
        return this.http.get<InternalDocumentResponse>(`${this.api}/${id}`, { withCredentials: true });
    }

    create(req: InternalDocumentRequest): Observable<InternalDocumentResponse> {
        return this.http.post<InternalDocumentResponse>(this.api, req, { withCredentials: true });
    }

    update(id: number, req: InternalDocumentRequest): Observable<InternalDocumentResponse> {
        return this.http.put<InternalDocumentResponse>(`${this.api}/${id}`, req, { withCredentials: true });
    }

    uploadAttachment(id: number, file: File): Observable<InternalDocumentResponse> {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<InternalDocumentResponse>(`${this.api}/${id}/attachment`, fd, {
            withCredentials: true,
        });
    }

    getAttachmentUrl(id: number): string {
        return `${this.api}/${id}/attachment`;
    }

    issue(id: number): Observable<InternalDocumentResponse> {
        return this.http.post<InternalDocumentResponse>(`${this.api}/${id}/issue`, {}, { withCredentials: true });
    }

    archive(id: number): Observable<InternalDocumentResponse> {
        return this.http.post<InternalDocumentResponse>(`${this.api}/${id}/archive`, {}, { withCredentials: true });
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.api}/${id}`, { withCredentials: true });
    }
}