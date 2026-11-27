import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import {
    TaskGroupMember,
    TaskGroupRequest,
    TaskGroupResponse,
    TaskGroupService,
} from '../../services/task-group.service';

@Component({
    selector: 'app-task-groups',
    imports: [FormsModule, RouterLink],
    templateUrl: './task-groups.html',
    styleUrl: './task-groups.css',
})
export class TaskGroups implements OnInit, OnDestroy {
    groups = signal<TaskGroupResponse[]>([]);
    loading = signal(false);
    pageError = signal('');
    keyword = '';

    /** Nhóm đang mở danh sách thành viên trong bảng. */
    expandedId = signal<number | null>(null);

    // Hộp thoại thêm, sửa
    showModal = signal(false);
    submitting = signal(false);
    editingId = signal<number | null>(null);
    modalError = signal('');
    formName = '';
    formDescription = '';

    // Chọn thành viên
    memberOptions = signal<TaskGroupMember[]>([]);
    loadingMembers = signal(false);
    memberKeyword = signal('');
    selectedIds = signal<Set<number>>(new Set<number>());

    filteredOptions = computed(() => {
        const kw = this.memberKeyword().trim().toLowerCase();
        const all = this.memberOptions();
        if (!kw) return all;
        return all.filter(
            (u) =>
                u.fullName.toLowerCase().includes(kw) ||
                u.email.toLowerCase().includes(kw) ||
                (u.departmentName ?? '').toLowerCase().includes(kw)
        );
    });

    selectedCount = computed(() => this.selectedIds().size);

    private keyword$ = new Subject<string>();
    private keywordSub?: Subscription;

    constructor(
        private groupService: TaskGroupService,
        private authService: AuthService
    ) { }

    ngOnInit() {
        this.loadGroups();
        this.keywordSub = this.keyword$
            .pipe(debounceTime(300), distinctUntilChanged())
            .subscribe(() => this.loadGroups());
    }

    ngOnDestroy() {
        this.keywordSub?.unsubscribe();
    }

    onKeywordInput(value: string) {
        this.keyword = value;
        this.keyword$.next(value);
    }

    /** Admin, Giám đốc, Phó giám đốc, Trưởng phòng được tạo nhóm công việc (máy chủ cũng kiểm tra lại). */
    canCreate(): boolean {
        return this.authService.hasAnyRole(['ADMIN', 'DIRECTOR', 'DEPUTY_DIRECTOR', 'HEAD']);
    }

    loadGroups() {
        this.loading.set(true);
        this.pageError.set('');
        this.groupService.findAll(this.keyword).subscribe({
            next: (data) => {
                this.groups.set(data);
                this.loading.set(false);
            },
            error: (err) => {
                this.loading.set(false);
                this.pageError.set(err.error?.message ?? 'Không thể tải danh sách nhóm công việc');
            },
        });
    }

    toggleExpand(id: number) {
        this.expandedId.set(this.expandedId() === id ? null : id);
    }

    // --- Hộp thoại ---

    openCreateModal() {
        this.editingId.set(null);
        this.formName = '';
        this.formDescription = '';
        this.selectedIds.set(new Set<number>());
        this.memberKeyword.set('');
        this.modalError.set('');
        this.ensureMemberOptions();
        this.showModal.set(true);
    }

    openEditModal(group: TaskGroupResponse) {
        this.editingId.set(group.id);
        this.formName = group.name;
        this.formDescription = group.description ?? '';
        this.selectedIds.set(new Set<number>(group.members.map((m) => m.id)));
        this.memberKeyword.set('');
        this.modalError.set('');
        this.ensureMemberOptions();
        this.showModal.set(true);
    }

    closeModal() {
        if (this.submitting()) return;
        this.showModal.set(false);
    }

    private ensureMemberOptions() {
        if (this.memberOptions().length > 0) return;
        this.loadingMembers.set(true);
        this.groupService.memberOptions().subscribe({
            next: (list) => {
                this.memberOptions.set(list);
                this.loadingMembers.set(false);
            },
            error: (err) => {
                this.loadingMembers.set(false);
                this.modalError.set(err.error?.message ?? 'Không thể tải danh sách người dùng');
            },
        });
    }

    isSelected(id: number): boolean {
        return this.selectedIds().has(id);
    }

    toggleMember(id: number, checked: boolean) {
        const next = new Set<number>(this.selectedIds());
        if (checked) {
            next.add(id);
        } else {
            next.delete(id);
        }
        this.selectedIds.set(next);
    }

    clearSelection() {
        this.selectedIds.set(new Set<number>());
    }

    saveGroup() {
        const name = this.formName.trim();
        if (!name) {
            this.modalError.set('Tên nhóm không được để trống');
            return;
        }

        const payload: TaskGroupRequest = {
            name,
            description: this.formDescription.trim() ? this.formDescription.trim() : null,
            memberIds: Array.from(this.selectedIds()),
        };

        this.submitting.set(true);
        this.modalError.set('');

        const id = this.editingId();
        const request$ = id
            ? this.groupService.update(id, payload)
            : this.groupService.create(payload);

        request$.subscribe({
            next: () => {
                this.submitting.set(false);
                this.showModal.set(false);
                this.loadGroups();
            },
            error: (err) => {
                this.submitting.set(false);
                this.modalError.set(err.error?.message ?? 'Lưu nhóm công việc thất bại');
            },
        });
    }

    deleteGroup(group: TaskGroupResponse) {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa nhóm "${group.name}"?`)) return;

        this.pageError.set('');
        this.groupService.delete(group.id).subscribe({
            next: () => this.loadGroups(),
            error: (err) => {
                this.pageError.set(err.error?.message ?? 'Không thể xóa nhóm công việc');
            },
        });
    }

    formatDate(iso: string | null | undefined): string {
        if (!iso) return '—';
        const parts = iso.slice(0, 10).split('-');
        if (parts.length !== 3) return iso;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
}