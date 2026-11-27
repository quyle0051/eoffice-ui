import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TaskGroupMember {
    id: number;
    fullName: string;
    email: string;
    departmentName: string | null;
}

export interface TaskGroupResponse {
    id: number;
    name: string;
    description: string | null;
    createdAt: string;
    creatorId: number | null;
    creatorName: string | null;
    memberCount: number;
    members: TaskGroupMember[];
    /** Người đang đăng nhập có được sửa, xóa nhóm này không. */
    canManage: boolean;
}

export interface TaskGroupRequest {
    name: string;
    description?: string | null;
    memberIds: number[];
}

@Injectable({ providedIn: 'root' })
export class TaskGroupService {
    private readonly api = '/api/task-groups';

    constructor(private http: HttpClient) { }

    findAll(keyword?: string): Observable<TaskGroupResponse[]> {
        let params = new HttpParams();
        if (keyword && keyword.trim()) {
            params = params.set('keyword', keyword.trim());
        }
        return this.http.get<TaskGroupResponse[]>(this.api, { params, withCredentials: true });
    }

    /** Danh sách người dùng để chọn thành viên. */
    memberOptions(): Observable<TaskGroupMember[]> {
        return this.http.get<TaskGroupMember[]>(`${this.api}/member-options`, { withCredentials: true });
    }

    create(req: TaskGroupRequest): Observable<TaskGroupResponse> {
        return this.http.post<TaskGroupResponse>(this.api, req, { withCredentials: true });
    }

    update(id: number, req: TaskGroupRequest): Observable<TaskGroupResponse> {
        return this.http.put<TaskGroupResponse>(`${this.api}/${id}`, req, { withCredentials: true });
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.api}/${id}`, { withCredentials: true });
    }
}