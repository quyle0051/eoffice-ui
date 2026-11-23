import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PageResponse<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
}

export interface IncomingDocumentRequest {
    documentBookId: number;
    documentTypeId: number;
    subject: string;
    codeNumber?: string | null;
    codeNotation?: string | null;
    issuedDate?: string | null;
    organName?: string | null;
    language?: string | null;
    pageAmount?: number | null;
    docOrdinal?: number | null;
    description?: string | null;
    arrivalDate?: string | null;
    signerPosition?: string | null;
    signerFullName?: string | null;
    priority?: number | null;
    toPlaces?: string | null;
    traceHeaderList?: string | null;
    dueDate?: string | null;
}

export interface IncomingDocumentResponse {
    id: number;
    documentBookId: number;
    documentBookName: string;
    documentTypeId: number;
    documentTypeName: string;
    documentTypeAbbreviation: string;
    arrivalNumber: number;
    arrivalDate: string;
    codeNumber: string | null;
    codeNotation: string | null;
    issuedDate: string | null;
    organName: string | null;
    subject: string;
    language: string | null;
    pageAmount: number | null;
    docOrdinal: number | null;
    description: string | null;
    signerPosition: string | null;
    signerFullName: string | null;
    priority: number | null;
    toPlaces: string | null;
    traceHeaderList: string | null;
    dueDate: string | null;
    status?: string;
    attachmentName?: string | null;
    currentHandlerId?: number | null;
    currentHandlerEmail?: string | null;
    currentHandlerName?: string | null;
}

export interface IncomingSearchParams {
    keyword?: string;
    documentBookId?: number | null;
    documentTypeId?: number | null;
    arrivalFrom?: string;
    arrivalTo?: string;
    // Tìm nâng cao
    status?: string;
    priority?: number | null;
    signer?: string;
    organ?: string;
    dueFrom?: string;
    dueTo?: string;
    overdue?: boolean;
    hasAttachment?: boolean;
    page?: number;
    size?: number;
}

export interface IncomingWorkflowRequest {
    receiverId?: number | null;
    directiveNote?: string | null;
    departmentIds?: number[];
    includeHead?: boolean;
    includeDeputy?: boolean;
    taskGroupIds?: number[];
    userIds?: number[];
}

export interface TransferHistoryResponse {
    id: number;
    stepType: string;
    senderName: string;
    senderEmail: string;
    receiverName: string;
    receiverEmail: string;
    departmentName: string | null;
    taskGroupName: string | null;
    directiveNote: string | null;
    status: string;
    createdAt: string;
    processedAt: string | null;
}

export interface UserOption {
    id: number;
    fullName: string;
    email: string;
    departmentName?: string;
    rolesLabel?: string;
}

export interface DepartmentOption {
    id: number;
    name: string;
    headId: number | null;
    headName: string | null;
    headEmail: string | null;
    deputyId: number | null;
    deputyName: string | null;
    deputyEmail: string | null;
    heads?: UserOption[];
    deputies?: UserOption[];
    clerks?: UserOption[];
}

export interface TaskGroupOption {
    id: number;
    name: string;
    memberCount: number;
    members: UserOption[];
}

export interface DispatchOptionsResponse {
    officeChiefs: UserOption[];
    directors: UserOption[];
    leaders: UserOption[];
    allUsers: UserOption[];
    departments: DepartmentOption[];
    taskGroups: TaskGroupOption[];
}

export interface IncomingDispatchRequest {
    mainAssigneeId: number;
    supervisorIds: number[];
    supporterUserIds: number[];
    primaryTaskGroupId?: number | null;
    toPlacesSummary: string;
    rows: {
        key?: string;
        type?: 'USER' | 'DEPARTMENT' | 'GROUP';
        targetLabel: string;
        codeNotation?: string;
        roleLabel: string;
        priorityLabel: string;
        dueDate: string | null;
        note: string;
        status?: string;
        groupId?: number;
        members?: {
            id: number;
            fullName: string;
            email: string;
            positionNote: string;
        }[];
    }[];
}

@Injectable({ providedIn: 'root' })
export class IncomingDocumentService {
    private readonly api = 'http://localhost:8080/api/incoming-documents';

    constructor(private http: HttpClient) { }

    search(params: IncomingSearchParams): Observable<PageResponse<IncomingDocumentResponse>> {
        let httpParams = new HttpParams()
            .set('page', String(params.page ?? 0))
            .set('size', String(params.size ?? 10));

        if (params.keyword && params.keyword.trim()) {
            httpParams = httpParams.set('keyword', params.keyword.trim());
        }
        if (params.documentBookId) {
            httpParams = httpParams.set('documentBookId', String(params.documentBookId));
        }
        if (params.documentTypeId) {
            httpParams = httpParams.set('documentTypeId', String(params.documentTypeId));
        }
        if (params.arrivalFrom) {
            httpParams = httpParams.set('arrivalFrom', params.arrivalFrom);
        }
        if (params.arrivalTo) {
            httpParams = httpParams.set('arrivalTo', params.arrivalTo);
        }
        if (params.status) {
            httpParams = httpParams.set('status', params.status);
        }
        if (params.priority !== null && params.priority !== undefined) {
            httpParams = httpParams.set('priority', String(params.priority));
        }
        if (params.signer && params.signer.trim()) {
            httpParams = httpParams.set('signer', params.signer.trim());
        }
        if (params.organ && params.organ.trim()) {
            httpParams = httpParams.set('organ', params.organ.trim());
        }
        if (params.dueFrom) {
            httpParams = httpParams.set('dueFrom', params.dueFrom);
        }
        if (params.dueTo) {
            httpParams = httpParams.set('dueTo', params.dueTo);
        }
        if (params.overdue) {
            httpParams = httpParams.set('overdue', 'true');
        }
        if (params.hasAttachment) {
            httpParams = httpParams.set('hasAttachment', 'true');
        }

        return this.http.get<PageResponse<IncomingDocumentResponse>>(this.api, {
            params: httpParams,
            withCredentials: true,
        });
    }

    findById(id: number): Observable<IncomingDocumentResponse> {
        return this.http.get<IncomingDocumentResponse>(`${this.api}/${id}`, {
            withCredentials: true,
        });
    }

    create(req: IncomingDocumentRequest): Observable<IncomingDocumentResponse> {
        return this.http.post<IncomingDocumentResponse>(this.api, req, {
            withCredentials: true,
        });
    }

    update(id: number, req: IncomingDocumentRequest): Observable<IncomingDocumentResponse> {
        return this.http.put<IncomingDocumentResponse>(`${this.api}/${id}`, req, {
            withCredentials: true,
        });
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.api}/${id}`, {
            withCredentials: true,
        });
    }

    getDispatchOptions(): Observable<DispatchOptionsResponse> {
        return this.http.get<DispatchOptionsResponse>(`${this.api}/dispatch-options`, {
            withCredentials: true,
        });
    }

    getHistory(id: number): Observable<TransferHistoryResponse[]> {
        return this.http.get<TransferHistoryResponse[]>(`${this.api}/${id}/history`, {
            withCredentials: true,
        });
    }

    submitToOfficeChief(id: number, req: IncomingWorkflowRequest): Observable<IncomingDocumentResponse> {
        return this.http.post<IncomingDocumentResponse>(`${this.api}/${id}/submit-chief`, req, {
            withCredentials: true,
        });
    }

    forwardToDirector(id: number, req: IncomingWorkflowRequest): Observable<IncomingDocumentResponse> {
        return this.http.post<IncomingDocumentResponse>(`${this.api}/${id}/forward-director`, req, {
            withCredentials: true,
        });
    }

    approveByDirector(id: number, req: IncomingWorkflowRequest): Observable<IncomingDocumentResponse> {
        return this.http.post<IncomingDocumentResponse>(`${this.api}/${id}/approve-director`, req, {
            withCredentials: true,
        });
    }

    dispatchToHandlers(id: number, req: IncomingWorkflowRequest): Observable<IncomingDocumentResponse> {
        return this.http.post<IncomingDocumentResponse>(`${this.api}/${id}/dispatch`, req, {
            withCredentials: true,
        });
    }

    uploadAttachment(id: number, file: File): Observable<IncomingDocumentResponse> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<IncomingDocumentResponse>(`${this.api}/${id}/attachment`, formData, {
            withCredentials: true,
        });
    }

    getAttachmentUrl(id: number): string {
        return `${this.api}/${id}/attachment`;
    }

    getDispatchTask(id: number): Observable<IncomingDispatchRequest | null> {
        return this.http.get<IncomingDispatchRequest | null>(`${this.api}/${id}/dispatch-task`, {
            withCredentials: true,
        });
    }

    dispatchTask(id: number, req: IncomingDispatchRequest): Observable<IncomingDocumentResponse> {
        return this.http.post<IncomingDocumentResponse>(`${this.api}/${id}/dispatch-task`, req, {
            withCredentials: true,
        });
    }
}