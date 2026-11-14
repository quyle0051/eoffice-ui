import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PageResponse } from './incoming-document.service';

export type TaskFilterMode = 'ASSIGNED' | 'SUPPORTED' | 'SUPERVISED' | 'CREATED';

export interface TaskResponse {
    id: number;
    title: string;
    parentTaskId?: number | null;
    parentTaskTitle?: string | null;
    taskGroupId?: number | null;
    taskGroupName?: string | null;
    incomingDocumentId?: number | null;
    incomingArrivalNumber?: number | null;
    incomingSubject?: string | null;
    creatorName: string;
    assigneeId: number;
    assigneeName: string;
    supervisorNames: string[];
    supporterNames: string[];
    startTime: string;
    endTime: string;
    status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
    progressPercent?: number;
    myRoleLabel?: string;
}

export interface TaskPostAttachmentResponse {
    id: number;
    fileName: string;
    fileType?: string;
    fileSize?: number;
    uploadedAt: string;
}

export interface TaskPostCommentResponse {
    id: number;
    authorId: number;
    authorName: string;
    authorEmail: string;
    content: string;
    createdAt: string;
}

export interface TaskPostResponse {
    id: number;
    authorId: number;
    authorName: string;
    authorEmail: string;
    authorRoleLabel: string;
    weekLabel?: string | null;
    postType: 'PROGRESS_REPORT' | 'DISCUSSION' | 'DIRECTIVE';
    progressPercent?: number | null;
    content: string;
    createdAt: string;
    attachments: TaskPostAttachmentResponse[];
    comments: TaskPostCommentResponse[];
}

export interface TaskDetailResponse {
    id: number;
    title: string;
    description?: string | null;
    parentTaskId?: number | null;
    parentTaskTitle?: string | null;
    taskGroupId?: number | null;
    taskGroupName?: string | null;
    incomingDocumentId?: number | null;
    incomingArrivalNumber?: number | null;
    incomingSubject?: string | null;
    incomingAttachmentName?: string | null;
    creatorId: number;
    creatorName: string;
    creatorEmail: string;
    assigneeId: number;
    assigneeName: string;
    assigneeEmail: string;
    supervisors: { id: number; fullName: string; email: string }[];
    supporters: { id: number; fullName: string; email: string }[];
    startTime: string;
    endTime: string;
    status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
    progressPercent: number;
    subTasks: TaskResponse[];
    posts: TaskPostResponse[];
}

export interface SubTaskCreateRequest {
    title: string;
    description?: string;
    mainAssigneeId: number;
    supervisorIds: number[];
    supporterUserIds: number[];
    primaryTaskGroupId?: number | null;
    dueDate: string | null;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
    private readonly api = 'http://localhost:8080/api/tasks';

    constructor(private http: HttpClient) { }

    search(
        mode: TaskFilterMode,
        keyword?: string,
        status?: string,
        page = 0,
        size = 10
    ): Observable<PageResponse<TaskResponse>> {
        let params = new HttpParams()
            .set('mode', mode)
            .set('page', page)
            .set('size', size);

        if (keyword && keyword.trim()) {
            params = params.set('keyword', keyword.trim());
        }
        if (status) {
            params = params.set('status', status);
        }

        return this.http.get<PageResponse<TaskResponse>>(this.api, {
            params,
            withCredentials: true,
        });
    }

    /** Lấy chi tiết công việc kèm danh sách việc con và bảng tin báo cáo */
    getDetail(taskId: number): Observable<TaskDetailResponse> {
        return this.http.get<TaskDetailResponse>(`${this.api}/${taskId}`, {
            withCredentials: true,
        });
    }

    /** Cập nhật nhanh trạng thái công việc */
    updateStatus(taskId: number, status: string): Observable<TaskDetailResponse> {
        return this.http.put<TaskDetailResponse>(
            `${this.api}/${taskId}/status`,
            { status },
            { withCredentials: true }
        );
    }

    /** Người chủ trì chia nhỏ công việc thành việc con (Sub-task) */
    createSubTask(parentTaskId: number, req: SubTaskCreateRequest): Observable<TaskResponse> {
        return this.http.post<TaskResponse>(`${this.api}/${parentTaskId}/subtasks`, req, {
            withCredentials: true,
        });
    }

    /** Đăng bài báo cáo tiến độ tuần (kèm nhiều file đính kèm) */
    createPost(
        taskId: number,
        payload: {
            weekLabel: string;
            postType: string;
            progressPercent: number | null;
            content: string;
        },
        files: File[]
    ): Observable<TaskPostResponse> {
        const formData = new FormData();
        formData.append('weekLabel', payload.weekLabel || '');
        formData.append('postType', payload.postType || 'PROGRESS_REPORT');
        if (payload.progressPercent !== null && payload.progressPercent !== undefined) {
            formData.append('progressPercent', String(payload.progressPercent));
        }
        formData.append('content', payload.content);

        for (const f of files) {
            formData.append('files', f);
        }

        return this.http.post<TaskPostResponse>(`${this.api}/${taskId}/posts`, formData, {
            withCredentials: true,
        });
    }

    /** Thêm bình luận dưới bài báo cáo */
    addComment(taskId: number, postId: number, content: string): Observable<TaskPostCommentResponse> {
        return this.http.post<TaskPostCommentResponse>(
            `${this.api}/${taskId}/posts/${postId}/comments`,
            { content },
            { withCredentials: true }
        );
    }

    /** Đường dẫn tải file đính kèm của bài báo cáo */
    getPostAttachmentUrl(attachmentId: number): string {
        return `${this.api}/attachments/${attachmentId}`;
    }
}