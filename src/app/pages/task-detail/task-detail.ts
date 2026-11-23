import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DepartmentOption, DispatchOptionsResponse, IncomingDocumentService, UserOption, } from '../../services/incoming-document.service';
import { SubTaskCreateRequest, TaskDetailResponse, TaskPostResponse, TaskService, } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { DeptRoleSelection, DispatchTableRow, PickerType, } from '../incoming-document-dispatch/incoming-document-dispatch';

@Component({
    selector: 'app-task-detail',
    imports: [FormsModule, RouterLink],
    templateUrl: './task-detail.html',
    styleUrl: './task-detail.css',
})
export class TaskDetail implements OnInit {
    taskId = signal<number>(0);
    task = signal<TaskDetailResponse | null>(null);
    options = signal<DispatchOptionsResponse | null>(null);

    loading = signal(false);
    errorMessage = signal('');
    successMessage = signal('');

    // Kiểm tra người đăng nhập có phải Người chủ trì của công việc này không
    isMainAssignee = computed(() => {
        const t = this.task();
        const myEmail = this.authService.user()?.email;
        if (!t || !myEmail) return false;
        return t.assigneeEmail?.toLowerCase() === myEmail.toLowerCase();
    });

    // Chỉ Người chủ trì của công việc này mới được kết thúc (và chưa kết thúc)
    canFinish = computed(() => {
        const t = this.task();
        return this.isMainAssignee() && !!t && t.status !== 'COMPLETED';
    });
    finishing = signal(false);

    // Kiểm tra người đăng nhập có quyền cập nhật trạng thái (Chủ trì hoặc Người giao)
    canUpdateStatus = computed(() => {
        const t = this.task();
        const myEmail = this.authService.user()?.email;
        if (!t || !myEmail || t.status === 'COMPLETED') return false;
        return (
            t.assigneeEmail?.toLowerCase() === myEmail.toLowerCase() ||
            t.creatorEmail?.toLowerCase() === myEmail.toLowerCase() ||
            this.authService.hasAnyRole(['ADMIN'])
        );
    });

    // =========================================================================
    // PHẦN 1: CHIA NHỎ CÔNG VIỆC (SUB-TASK) - GIỐNG PHÂN PHỐI CỦA VĂN THƯ
    // =========================================================================
    showSubTaskForm = signal(false);
    subTaskTitle = '';
    subTaskDueDate = '';
    subTaskDescription = '';
    subTaskSubmitting = signal(false);

    // Bảng cấu hình người nhận việc con (Chủ trì / Giám sát / Hỗ trợ)
    subTaskRows = signal<DispatchTableRow[]>([]);
    activePicker = signal<PickerType>(null);
    pickerKeyword = signal('');
    supportTab = signal<'DEPT' | 'GROUP' | 'USER'>('USER');

    tempMainUserId = signal<number | null>(null);
    tempSupervisorIds = signal(new Set<number>());
    tempSupportDeptRoles = signal(new Map<number, DeptRoleSelection>());
    tempSupportGroupIds = signal(new Set<number>());
    tempSupportUserIds = signal(new Set<number>());

    subMainRows = computed(() => this.subTaskRows().filter((r) => r.role === 'Chủ trì'));
    subSupervisorRows = computed(() => this.subTaskRows().filter((r) => r.role === 'Giám sát'));
    subSupportRows = computed(() => this.subTaskRows().filter((r) => r.role === 'Hỗ trợ'));

    filteredAllUsers = computed(() => {
        const kw = this.pickerKeyword().trim().toLowerCase();
        const list = this.options()?.allUsers ?? [];
        if (!kw) return list;
        return list.filter(
            (u) =>
                u.fullName.toLowerCase().includes(kw) ||
                u.email.toLowerCase().includes(kw) ||
                (u.departmentName ?? '').toLowerCase().includes(kw) ||
                (u.rolesLabel ?? '').toLowerCase().includes(kw)
        );
    });

    // =========================================================================
    // PHẦN 2: ĐĂNG BÀI BÁO CÁO TIẾN ĐỘ TUẦN (TASK FEED NHƯ FACEBOOK)
    // =========================================================================
    postType: 'PROGRESS_REPORT' | 'DISCUSSION' | 'DIRECTIVE' = 'PROGRESS_REPORT';
    weekLabel = this.defaultWeekLabel();
    progressPercent = 0;
    postContent = '';
    selectedPostFiles: File[] = [];
    posting = signal(false);

    // Lưu nội dung bình luận đang gõ theo từng postId
    commentInputs: Record<number, string> = {};

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        public taskService: TaskService,
        public docService: IncomingDocumentService,
        private authService: AuthService
    ) { }

    ngOnInit() {
        this.route.paramMap.subscribe((params) => {
            const id = Number(params.get('id'));
            if (id) {
                this.taskId.set(id);
                this.loadTaskDetail(id);
            }
        });
    }

    private optionsTaskId: number | null = null;

    private loadAssignableOptions(taskId: number) {
        if (!this.isMainAssignee()) {
            this.options.set(null);
            this.optionsTaskId = null;
            return;
        }
        if (this.optionsTaskId === taskId) return;
        this.optionsTaskId = taskId;
        this.taskService.getAssignableOptions(taskId).subscribe({
            next: (opts) => this.options.set(opts),
            error: () => {
                this.options.set(null);
                this.optionsTaskId = null;
            },
        });
    }

    loadTaskDetail(id: number) {
        this.loading.set(true);
        this.errorMessage.set('');
        this.taskService.getDetail(id).subscribe({
            next: (data) => {
                this.task.set(data);
                this.progressPercent = data.progressPercent ?? 0;
                this.subTaskDueDate = data.endTime ? data.endTime.slice(0, 10) : '';
                this.loading.set(false);
                this.loadAssignableOptions(id);
            },
            error: (err) => {
                this.loading.set(false);
                this.errorMessage.set(err.error?.message ?? 'Không thể tải thông tin chi tiết công việc');
            },
        });
    }

    onStatusChange(newStatus: string) {
        this.taskService.updateStatus(this.taskId(), newStatus).subscribe({
            next: (updated) => {
                this.task.set(updated);
                this.progressPercent = updated.progressPercent ?? this.progressPercent;
            },
            error: (err) => {
                this.errorMessage.set(err.error?.message ?? 'Không thể cập nhật trạng thái công việc');
            },
        });
    }

    /** Người chủ trì kết thúc công việc (việc gốc: văn bản đến -> Hoàn thành; việc con: không ảnh hưởng văn bản) */
    finishTask() {
        const t = this.task();
        if (!t || !this.canFinish() || this.finishing()) return;

        const openSubTasks = (t.subTasks ?? []).filter((s) => s.status !== 'COMPLETED').length;
        let message = `Xác nhận kết thúc công việc "${t.title}"?`;
        if (openSubTasks > 0) {
            message += `\n\nLưu ý: còn ${openSubTasks} việc con chưa kết thúc.`;
        }
        if (!t.parentTaskId && t.incomingDocumentId) {
            message += '\n\nKhi tất cả công việc của văn bản đến này đã kết thúc, văn bản sẽ chuyển sang "Hoàn thành".';
        }
        if (!window.confirm(message)) return;

        this.finishing.set(true);
        this.errorMessage.set('');
        this.taskService.finishTask(this.taskId()).subscribe({
            next: (updated) => {
                this.finishing.set(false);
                this.task.set(updated);
                this.progressPercent = updated.progressPercent ?? this.progressPercent;
            },
            error: (err) => {
                this.finishing.set(false);
                this.errorMessage.set(err.error?.message ?? 'Không thể kết thúc công việc');
            },
        });
    }

    // --- LOGIC MỞ KHUNG & POPUP CHIA NHỎ CÔNG VIỆC ---

    toggleSubTaskForm() {
        const nextState = !this.showSubTaskForm();
        this.showSubTaskForm.set(nextState);
        if (nextState && this.subTaskRows().length === 0) {
            // Mặc định tự gán Người chủ trì việc chính làm Người giám sát của việc con
            const currentTask = this.task();
            if (currentTask) {
                this.subTaskTitle = `${currentTask.title} (Nhiệm vụ chi tiết)`;
                this.subTaskRows.set([
                    {
                        key: `SUP_USER_${currentTask.assigneeId}`,
                        type: 'USER',
                        role: 'Giám sát',
                        targetLabel: `${currentTask.assigneeName} (Người giao việc con)`,
                        codeNotation: '—',
                        priority: 'Bình thường',
                        dueDate: currentTask.endTime ? currentTask.endTime.slice(0, 10) : '',
                        note: '',
                        status: 'Chưa xem',
                        members: [
                            {
                                id: currentTask.assigneeId,
                                fullName: currentTask.assigneeName,
                                email: currentTask.assigneeEmail,
                                positionNote: 'Giám sát',
                            },
                        ],
                        expanded: false,
                    },
                ]);
            }
        }
    }

    openPicker(type: PickerType) {
        this.pickerKeyword.set('');
        this.activePicker.set(type);
        if (type === 'MAIN') {
            this.tempMainUserId.set(this.subMainRows()[0]?.members[0]?.id ?? null);
        } else if (type === 'SUPERVISOR') {
            const ids = new Set<number>();
            this.subSupervisorRows().forEach((r) => r.members.forEach((m) => ids.add(m.id)));
            this.tempSupervisorIds.set(ids);
        }
    }

    closePicker() {
        this.activePicker.set(null);
    }

    confirmMainPicker() {
        const uid = this.tempMainUserId();
        const user = this.options()?.allUsers.find((u) => u.id === uid);
        if (!user) {
            this.closePicker();
            return;
        }
        const others = this.subTaskRows().filter((r) => r.role !== 'Chủ trì');
        const newRow: DispatchTableRow = {
            key: `MAIN_USER_${user.id}`,
            type: 'USER',
            role: 'Chủ trì',
            targetLabel: `${user.fullName}${user.departmentName ? ' / ' + user.departmentName : ''}`,
            codeNotation: '—',
            priority: 'Bình thường',
            dueDate: this.subTaskDueDate,
            note: '',
            status: 'Chưa xem',
            members: [
                {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                    positionNote: user.rolesLabel || 'Chủ trì việc con',
                },
            ],
            expanded: false,
        };
        this.subTaskRows.set([newRow, ...others]);
        this.closePicker();
    }

    toggleSupervisor(userId: number, checked: boolean) {
        const next = new Set(this.tempSupervisorIds());
        if (checked) next.add(userId);
        else next.delete(userId);
        this.tempSupervisorIds.set(next);
    }

    confirmSupervisorPicker() {
        const allUsers = this.options()?.allUsers ?? [];
        const nonSup = this.subTaskRows().filter((r) => r.role !== 'Giám sát');
        const supRows: DispatchTableRow[] = [];

        this.tempSupervisorIds().forEach((uid) => {
            const u = allUsers.find((item) => item.id === uid);
            if (u) {
                supRows.push({
                    key: `SUP_USER_${u.id}`,
                    type: 'USER',
                    role: 'Giám sát',
                    targetLabel: `${u.fullName}${u.departmentName ? ' / ' + u.departmentName : ''}`,
                    codeNotation: '—',
                    priority: 'Bình thường',
                    dueDate: this.subTaskDueDate,
                    note: '',
                    status: 'Chưa xem',
                    members: [
                        {
                            id: u.id,
                            fullName: u.fullName,
                            email: u.email,
                            positionNote: u.rolesLabel || 'Giám sát',
                        },
                    ],
                    expanded: false,
                });
            }
        });

        const mains = nonSup.filter((r) => r.role === 'Chủ trì');
        const supports = nonSup.filter((r) => r.role === 'Hỗ trợ');
        this.subTaskRows.set([...mains, ...supRows, ...supports]);
        this.closePicker();
    }

    isDeptRoleChecked(deptId: number, which: 'head' | 'deputy'): boolean {
        return this.tempSupportDeptRoles().get(deptId)?.[which] ?? false;
    }

    toggleDeptRole(dept: DepartmentOption, which: 'head' | 'deputy', checked: boolean) {
        const map = new Map(this.tempSupportDeptRoles());
        const cur = map.get(dept.id) ?? { head: false, deputy: false };
        cur[which] = checked;
        if (!cur.head && !cur.deputy) map.delete(dept.id);
        else map.set(dept.id, cur);
        this.tempSupportDeptRoles.set(map);
    }

    toggleSupportGroup(groupId: number, checked: boolean) {
        const next = new Set(this.tempSupportGroupIds());
        if (checked) next.add(groupId);
        else next.delete(groupId);
        this.tempSupportGroupIds.set(next);
    }

    toggleSupportUser(userId: number, checked: boolean) {
        const next = new Set(this.tempSupportUserIds());
        if (checked) next.add(userId);
        else next.delete(userId);
        this.tempSupportUserIds.set(next);
    }

    confirmSupportPicker() {
        const opts = this.options();
        if (!opts) return;

        const nonSupport = this.subTaskRows().filter((r) => r.role !== 'Hỗ trợ');
        const supportRows: DispatchTableRow[] = [];

        this.tempSupportDeptRoles().forEach((roleCfg, deptId) => {
            const dept = opts.departments.find((d) => d.id === deptId);
            if (!dept) return;
            const members: { id: number; fullName: string; email: string; positionNote: string }[] = [];
            if (roleCfg.head && dept.headId && dept.headName) {
                members.push({
                    id: dept.headId,
                    fullName: dept.headName,
                    email: dept.headEmail ?? '',
                    positionNote: 'Trưởng phòng',
                });
            }
            if (roleCfg.deputy) {
                if (dept.deputies && dept.deputies.length > 0) {
                    dept.deputies.forEach((dp) =>
                        members.push({
                            id: dp.id,
                            fullName: dp.fullName,
                            email: dp.email,
                            positionNote: 'Phó phòng',
                        })
                    );
                } else if (dept.deputyId && dept.deputyName) {
                    members.push({
                        id: dept.deputyId,
                        fullName: dept.deputyName,
                        email: dept.deputyEmail ?? '',
                        positionNote: 'Phó phòng',
                    });
                }
            }
            if (members.length > 0) {
                supportRows.push({
                    key: `SPT_DEPT_${dept.id}`,
                    type: 'DEPARTMENT',
                    role: 'Hỗ trợ',
                    targetLabel: `Phòng: ${dept.name}`,
                    codeNotation: '—',
                    priority: 'Bình thường',
                    dueDate: this.subTaskDueDate,
                    note: '',
                    status: 'Chưa xem',
                    members,
                    expanded: false,
                });
            }
        });

        this.tempSupportGroupIds().forEach((gid) => {
            const grp = opts.taskGroups.find((g) => g.id === gid);
            if (!grp) return;
            supportRows.push({
                key: `SPT_GRP_${grp.id}`,
                type: 'GROUP',
                role: 'Hỗ trợ',
                targetLabel: `Nhóm: ${grp.name}`,
                codeNotation: '—',
                priority: 'Bình thường',
                dueDate: this.subTaskDueDate,
                note: '',
                status: 'Chưa xem',
                members: (grp.members ?? []).map((m) => ({
                    id: m.id,
                    fullName: m.fullName,
                    email: m.email,
                    positionNote: m.departmentName || 'Thành viên nhóm',
                })),
                expanded: false,
                groupId: grp.id,
            });
        });

        this.tempSupportUserIds().forEach((uid) => {
            const usr = opts.allUsers.find((u) => u.id === uid);
            if (!usr) return;
            supportRows.push({
                key: `SPT_USER_${usr.id}`,
                type: 'USER',
                role: 'Hỗ trợ',
                targetLabel: `${usr.fullName}${usr.departmentName ? ' / ' + usr.departmentName : ''}`,
                codeNotation: '—',
                priority: 'Bình thường',
                dueDate: this.subTaskDueDate,
                note: '',
                status: 'Chưa xem',
                members: [
                    {
                        id: usr.id,
                        fullName: usr.fullName,
                        email: usr.email,
                        positionNote: usr.rolesLabel || 'Chuyên viên',
                    },
                ],
                expanded: false,
            });
        });

        this.subTaskRows.set([...nonSupport, ...supportRows]);
        this.closePicker();
    }

    removeSubRow(key: string) {
        this.subTaskRows.set(this.subTaskRows().filter((r) => r.key !== key));
    }

    submitSubTask() {
        this.errorMessage.set('');
        if (!this.subTaskTitle.trim()) {
            this.errorMessage.set('Vui lòng nhập tên công việc con');
            return;
        }
        const mainRow = this.subMainRows()[0];
        if (!mainRow || mainRow.members.length === 0) {
            this.errorMessage.set('Vui lòng chọn 1 Người chủ trì cho công việc con');
            return;
        }

        const supIds = new Set<number>();
        this.subSupervisorRows().forEach((r) => r.members.forEach((m) => supIds.add(m.id)));

        const sptIds = new Set<number>();
        let groupId: number | null = null;
        this.subSupportRows().forEach((r) => {
            if (r.groupId && !groupId) groupId = r.groupId;
            r.members.forEach((m) => sptIds.add(m.id));
        });

        const req: SubTaskCreateRequest = {
            title: this.subTaskTitle.trim(),
            description: this.subTaskDescription.trim(),
            mainAssigneeId: mainRow.members[0].id,
            supervisorIds: Array.from(supIds),
            supporterUserIds: Array.from(sptIds),
            primaryTaskGroupId: groupId,
            dueDate: mainRow.dueDate || this.subTaskDueDate || null,
        };

        this.subTaskSubmitting.set(true);
        this.taskService.createSubTask(this.taskId(), req).subscribe({
            next: () => {
                this.subTaskSubmitting.set(false);
                this.showSubTaskForm.set(false);
                this.subTaskRows.set([]);
                this.loadTaskDetail(this.taskId());
            },
            error: (err) => {
                this.subTaskSubmitting.set(false);
                this.errorMessage.set(err.error?.message ?? 'Không thể tạo công việc con');
            },
        });
    }

    // --- LOGIC ĐĂNG BÁO CÁO TIẾN ĐỘ TUẦN & BÌNH LUẬN ---

    onPostFilesSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.selectedPostFiles = Array.from(input.files);
        } else {
            this.selectedPostFiles = [];
        }
    }

    removeSelectedFile(index: number) {
        this.selectedPostFiles.splice(index, 1);
    }

    submitPost() {
        if (!this.postContent.trim()) {
            this.errorMessage.set('Vui lòng nhập nội dung báo cáo / trao đổi');
            return;
        }
        this.errorMessage.set('');
        this.posting.set(true);

        const payload = {
            weekLabel: this.weekLabel.trim(),
            postType: this.postType,
            progressPercent: this.postType === 'PROGRESS_REPORT' ? Number(this.progressPercent) : null,
            content: this.postContent.trim(),
        };

        this.taskService.createPost(this.taskId(), payload, this.selectedPostFiles).subscribe({
            next: () => {
                this.posting.set(false);
                this.postContent = '';
                this.selectedPostFiles = [];
                this.loadTaskDetail(this.taskId());
            },
            error: (err) => {
                this.posting.set(false);
                this.errorMessage.set(err.error?.message ?? 'Đăng báo cáo thất bại');
            },
        });
    }

    submitComment(post: TaskPostResponse) {
        const text = (this.commentInputs[post.id] ?? '').trim();
        if (!text) return;

        this.taskService.addComment(this.taskId(), post.id, text).subscribe({
            next: (newComment) => {
                post.comments = [...(post.comments ?? []), newComment];
                this.commentInputs[post.id] = '';
            },
            error: (err) => {
                this.errorMessage.set(err.error?.message ?? 'Không thể gửi bình luận');
            },
        });
    }

    openSubTask(subTaskId: number) {
        this.router.navigate(['/tasks', subTaskId]);
    }

    // --- HÀM FORMAT HIỂN THỊ ---

    formatDateTime(iso: string | null | undefined): string {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
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

    postTypeLabel(type: string): string {
        switch (type) {
            case 'PROGRESS_REPORT':
                return 'Báo cáo tiến độ tuần';
            case 'DIRECTIVE':
                return 'Đôn đốc / Chỉ đạo';
            default:
                return 'Thảo luận phối hợp';
        }
    }

    private defaultWeekLabel(): string {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        return `Tuần ${weekNumber} - Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
    }
}