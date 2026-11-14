import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TaskFilterMode, TaskResponse, TaskService } from '../../services/task.service';

@Component({
    selector: 'app-task-list',
    imports: [FormsModule, RouterLink],
    templateUrl: './task-list.html',
    styleUrl: './task-list.css',
})
export class TaskList implements OnInit {
    // Tab hiện tại
    activeMode = signal<TaskFilterMode>('ASSIGNED');

    // Bộ lọc tìm kiếm
    keyword = '';
    selectedStatus = '';

    // Dữ liệu bảng & phân trang
    tasks = signal<TaskResponse[]>([]);
    loading = signal(false);
    errorMessage = signal('');

    page = signal(0);
    size = signal(10);
    totalElements = signal(0);
    totalPages = signal(0);

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private taskService: TaskService
    ) { }

    ngOnInit() {
        // Tự động chọn tab dựa theo đường dẫn URL (ví dụ /tasks/assigned, /tasks/created, /tasks/supervised)
        this.route.url.subscribe((segments) => {
            const lastSegment = segments[segments.length - 1]?.path;
            if (lastSegment === 'created') {
                this.activeMode.set('CREATED');
            } else if (lastSegment === 'supervised') {
                this.activeMode.set('SUPERVISED');
            } else if (lastSegment === 'supported') {
                this.activeMode.set('SUPPORTED');
            } else {
                this.activeMode.set('ASSIGNED');
            }
            this.page.set(0);
            this.loadTasks();
        });
    }

    switchMode(mode: TaskFilterMode) {
        this.activeMode.set(mode);
        this.page.set(0);
        this.loadTasks();
    }

    onSearch() {
        this.page.set(0);
        this.loadTasks();
    }

    resetFilters() {
        this.keyword = '';
        this.selectedStatus = '';
        this.page.set(0);
        this.loadTasks();
    }

    loadTasks() {
        this.loading.set(true);
        this.errorMessage.set('');

        this.taskService
            .search(this.activeMode(), this.keyword, this.selectedStatus, this.page(), this.size())
            .subscribe({
                next: (res) => {
                    this.tasks.set(res.content ?? []);
                    this.totalElements.set(res.totalElements ?? 0);
                    this.totalPages.set(res.totalPages ?? 0);
                    this.loading.set(false);
                },
                error: (err) => {
                    this.loading.set(false);
                    this.errorMessage.set(err.error?.message ?? 'Không thể tải danh sách công việc');
                },
            });
    }

    changePage(newPage: number) {
        if (newPage < 0 || newPage >= this.totalPages()) return;
        this.page.set(newPage);
        this.loadTasks();
    }

    onSizeChange(newSize: number) {
        this.size.set(Number(newSize));
        this.page.set(0);
        this.loadTasks();
    }

    /** Điều hướng sang trang Chi tiết công việc & Bảng tin báo cáo tuần */
    openTaskDetail(task: TaskResponse) {
        this.router.navigate(['/tasks', task.id]);
    }

    // --- CÁC HÀM HIỂN THỊ DỮ LIỆU ---

    formatDateTime(iso: string | null | undefined): string {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    statusLabel(status: string): string {
        switch (status) {
            case 'NEW':
                return 'Mới giao';
            case 'IN_PROGRESS':
                return 'Đang thực hiện';
            case 'COMPLETED':
                return 'Hoàn thành';
            case 'OVERDUE':
                return 'Quá hạn';
            case 'CANCELLED':
                return 'Đã hủy';
            default:
                return status;
        }
    }

    isOverdue(task: TaskResponse): boolean {
        if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
        if (!task.endTime) return false;
        return new Date(task.endTime).getTime() < Date.now();
    }
}