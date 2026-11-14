import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
    DepartmentOption,
    DispatchOptionsResponse,
    IncomingDispatchRequest,
    IncomingDocumentResponse,
    IncomingDocumentService,
    TaskGroupOption,
    UserOption,
} from '../../services/incoming-document.service';
import { forkJoin } from 'rxjs';

export interface DeptRoleSelection {
    head: boolean;
    deputy: boolean;
}

export type PickerType = 'MAIN' | 'SUPERVISOR' | 'SUPPORT' | null;

export interface DispatchTableRow {
    key: string;
    type: 'USER' | 'DEPARTMENT' | 'GROUP';
    role: 'Chủ trì' | 'Giám sát' | 'Hỗ trợ';
    targetLabel: string;
    codeNotation: string;
    priority: string;
    dueDate: string;
    note: string;
    status: string;
    // Danh sách user thực tế nằm trong dòng này (để bấm Xem thành viên nhóm/phòng ban)
    members: { id: number; fullName: string; email: string; positionNote: string }[];
    expanded: boolean;
    groupId?: number;
}

@Component({
    selector: 'app-incoming-document-dispatch',
    imports: [FormsModule, RouterLink],
    templateUrl: './incoming-document-dispatch.html',
    styleUrl: './incoming-document-dispatch.css',
})
export class IncomingDocumentDispatch implements OnInit {
    docId = signal<number>(0);
    doc = signal<IncomingDocumentResponse | null>(null);
    options = signal<DispatchOptionsResponse | null>(null);

    loading = signal(false);
    submitting = signal(false);
    errorMessage = signal('');

    // Danh sách các dòng hiển thị ở Bảng phân phối bên dưới
    tableRows = signal<DispatchTableRow[]>([]);

    // Quản lý Popup chọn (MAIN = Chủ trì 1 người, SUPERVISOR = Giám sát nhiều người, SUPPORT = Phòng ban/Nhóm/User hỗ trợ)
    activePicker = signal<PickerType>(null);
    pickerKeyword = signal('');
    supportTab = signal<'DEPT' | 'GROUP' | 'USER'>('DEPT');

    // Trạng thái chọn tạm thời trong Popup
    tempMainUserId = signal<number | null>(null);
    tempSupervisorIds = signal<Set<number>>(new Set());

    // Trong popup Hỗ trợ: cho phép tích chọn Trưởng phòng / Phó phòng của từng phòng ban, chọn Nhóm, chọn User lẻ
    tempSupportDeptRoles = signal(new Map<number, DeptRoleSelection>());
    tempSupportGroupIds = signal<Set<number>>(new Set());
    tempSupportUserIds = signal<Set<number>>(new Set());

    // Các danh sách chip hiển thị trên 3 khung xám giống hình mẫu
    mainRows = computed(() => this.tableRows().filter((r) => r.role === 'Chủ trì'));
    supervisorRows = computed(() => this.tableRows().filter((r) => r.role === 'Giám sát'));
    supportRows = computed(() => this.tableRows().filter((r) => r.role === 'Hỗ trợ'));

    filteredLeaders = computed(() => {
        const kw = this.pickerKeyword().trim().toLowerCase();
        const list = this.options()?.leaders ?? [];
        if (!kw) return list;
        return list.filter(
            (u) =>
                u.fullName.toLowerCase().includes(kw) ||
                u.email.toLowerCase().includes(kw) ||
                (u.departmentName ?? '').toLowerCase().includes(kw) ||
                (u.rolesLabel ?? '').toLowerCase().includes(kw)
        );
    });

    filteredAllUsers = computed(() => {
        const kw = this.pickerKeyword().trim().toLowerCase();
        const list = this.options()?.allUsers ?? [];
        if (!kw) return list;
        return list.filter(
            (u) =>
                u.fullName.toLowerCase().includes(kw) ||
                u.email.toLowerCase().includes(kw) ||
                (u.departmentName ?? '').toLowerCase().includes(kw)
        );
    });

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private docService: IncomingDocumentService
    ) { }

    ngOnInit() {
        const id = Number(this.route.snapshot.paramMap.get('id'));
        this.docId.set(id);
        this.loadData(id);
    }

    loadData(id: number) {
        this.loading.set(true);
        forkJoin({
            doc: this.docService.findById(id),
            opts: this.docService.getDispatchOptions(),
            saved: this.docService.getDispatchTask(id),
        }).subscribe({
            next: ({ doc, opts, saved }) => {
                this.doc.set(doc);
                this.options.set(opts);
                if (saved) {
                    this.restoreSavedDispatch(saved, opts);
                }
                this.loading.set(false);
            },
            error: (err) => {
                this.loading.set(false);
                this.errorMessage.set(err.error?.message ?? 'Không tải được thông tin phân phối văn bản');
            },
        });
    }

    private restoreSavedDispatch(saved: IncomingDispatchRequest, opts: DispatchOptionsResponse) {
        if (saved.rows && saved.rows.length > 0) {
            const restoredRows: DispatchTableRow[] = saved.rows.map((r, idx) => ({
                key: r.key || `ROW_${idx}`,
                type: (r.type as 'USER' | 'DEPARTMENT' | 'GROUP') || 'USER',
                role: (r.roleLabel as 'Chủ trì' | 'Giám sát' | 'Hỗ trợ') || 'Hỗ trợ',
                targetLabel: r.targetLabel,
                codeNotation: r.codeNotation || this.defaultCodeNotation(),
                priority: r.priorityLabel || 'Bình thường',
                dueDate: r.dueDate || this.doc()?.dueDate || '',
                note: r.note || '',
                status: r.status || 'Chưa xem',
                members: r.members ?? [],
                expanded: false,
                groupId: r.groupId,
            }));
            this.tableRows.set(restoredRows);

            // Đồng bộ lại trạng thái tick trong các Popup
            const deptMap = new Map<number, DeptRoleSelection>();
            const grpSet = new Set<number>();
            const usrSet = new Set<number>();

            restoredRows.forEach((row) => {
                if (row.key.startsWith('SPT_DEPT_')) {
                    const deptId = Number(row.key.replace('SPT_DEPT_', ''));
                    const dept = opts.departments.find((d) => d.id === deptId);
                    if (dept) {
                        const hasHead = row.members.some((m) => m.id === dept.headId);
                        const hasDeputy = row.members.some((m) => m.id === dept.deputyId);
                        deptMap.set(deptId, { head: hasHead, deputy: hasDeputy });
                    }
                } else if (row.key.startsWith('SPT_GRP_')) {
                    const gid = Number(row.key.replace('SPT_GRP_', ''));
                    grpSet.add(gid);
                } else if (row.key.startsWith('SPT_USER_')) {
                    const uid = Number(row.key.replace('SPT_USER_', ''));
                    usrSet.add(uid);
                }
            });

            this.tempSupportDeptRoles.set(deptMap);
            this.tempSupportGroupIds.set(grpSet);
            this.tempSupportUserIds.set(usrSet);
        }
    }

    //MỞ POPUP CHỌN

    openPicker(type: PickerType) {
        this.pickerKeyword.set('');
        this.activePicker.set(type);

        if (type === 'MAIN') {
            const currentMain = this.mainRows()[0]?.members[0]?.id ?? null;
            this.tempMainUserId.set(currentMain);
        } else if (type === 'SUPERVISOR') {
            const ids = new Set<number>();
            this.supervisorRows().forEach((r) => r.members.forEach((m) => ids.add(m.id)));
            this.tempSupervisorIds.set(ids);
        }
    }

    closePicker() {
        this.activePicker.set(null);
    }

    //Xác nhận chọn Người chủ trì (Chỉ 1 người)
    confirmMainPicker() {
        const uid = this.tempMainUserId();
        const user = this.options()?.leaders.find((u) => u.id === uid);
        if (!user) {
            this.closePicker();
            return;
        }

        const otherRows = this.tableRows().filter((r) => r.role !== 'Chủ trì');
        const newRow: DispatchTableRow = {
            key: `MAIN_USER_${user.id}`,
            type: 'USER',
            role: 'Chủ trì',
            targetLabel: `${user.fullName}${user.departmentName ? ' / ' + user.departmentName : ''}`,
            codeNotation: this.defaultCodeNotation(),
            priority: 'Bình thường',
            dueDate: this.doc()?.dueDate ?? '',
            note: '',
            status: 'Chưa xem',
            members: [
                {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                    positionNote: user.rolesLabel || 'Chủ trì',
                },
            ],
            expanded: false,
        };

        this.tableRows.set([newRow, ...otherRows]);
        this.closePicker();
    }

    //Xác nhận chọn Người giám sát (Chọn nhiều)
    toggleSupervisor(userId: number, checked: boolean) {
        const next = new Set(this.tempSupervisorIds());
        if (checked) next.add(userId);
        else next.delete(userId);
        this.tempSupervisorIds.set(next);
    }

    confirmSupervisorPicker() {
        const selectedIds = this.tempSupervisorIds();
        const leaders = this.options()?.leaders ?? [];
        const nonSupervisorRows = this.tableRows().filter((r) => r.role !== 'Giám sát');

        const newRows: DispatchTableRow[] = [];
        selectedIds.forEach((uid) => {
            const u = leaders.find((item) => item.id === uid);
            if (u) {
                newRows.push({
                    key: `SUP_USER_${u.id}`,
                    type: 'USER',
                    role: 'Giám sát',
                    targetLabel: `${u.fullName}${u.departmentName ? ' / ' + u.departmentName : ''}`,
                    codeNotation: this.defaultCodeNotation(),
                    priority: 'Bình thường',
                    dueDate: this.doc()?.dueDate ?? '',
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

        // Giữ thứ tự: Chủ trì -> Giám sát -> Hỗ trợ
        const mains = nonSupervisorRows.filter((r) => r.role === 'Chủ trì');
        const supports = nonSupervisorRows.filter((r) => r.role === 'Hỗ trợ');
        this.tableRows.set([...mains, ...newRows, ...supports]);
        this.closePicker();
    }

    //Xử lý chọn trong Popup Phòng ban / Nhóm công việc / Người hỗ trợ
    isDeptRoleChecked(deptId: number, which: 'head' | 'deputy'): boolean {
        return this.tempSupportDeptRoles().get(deptId)?.[which] ?? false;
    }

    toggleDeptRole(dept: DepartmentOption, which: 'head' | 'deputy', checked: boolean) {
        const map = new Map(this.tempSupportDeptRoles());
        const cur = map.get(dept.id) ?? { head: false, deputy: false };
        cur[which] = checked;
        if (!cur.head && !cur.deputy) {
            map.delete(dept.id);
        } else {
            map.set(dept.id, cur);
        }
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

        const nonSupportRows = this.tableRows().filter((r) => r.role !== 'Hỗ trợ');
        const supportRows: DispatchTableRow[] = [];

        //Tạo các dòng Phòng ban được chọn (kèm danh sách Trưởng/Phó phòng bên trong để bấm Xem)
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
                        }));
                } else if (dept.deputyId && dept.deputyName) {
                    members.push({ id: dept.deputyId, fullName: dept.deputyName, email: dept.deputyEmail ?? '', positionNote: 'Phó phòng' });
                }
            }

            if (members.length > 0) {
                supportRows.push({
                    key: `SPT_DEPT_${dept.id}`,
                    type: 'DEPARTMENT',
                    role: 'Hỗ trợ',
                    targetLabel: `Phòng: ${dept.name}`,
                    codeNotation: this.defaultCodeNotation(),
                    priority: 'Bình thường',
                    dueDate: this.doc()?.dueDate ?? '',
                    note: '',
                    status: 'Chưa xem',
                    members,
                    expanded: false,
                });
            }
        });

        //Tạo các dòng Nhóm công việc được chọn (kèm danh sách thành viên trong nhóm để bấm Xem)
        this.tempSupportGroupIds().forEach((gid) => {
            const grp = opts.taskGroups.find((g) => g.id === gid);
            if (!grp) return;

            const members = (grp.members ?? []).map((m) => ({
                id: m.id,
                fullName: m.fullName,
                email: m.email,
                positionNote: m.departmentName ? `Thành viên (${m.departmentName})` : 'Thành viên nhóm',
            }));

            supportRows.push({
                key: `SPT_GRP_${grp.id}`,
                type: 'GROUP',
                role: 'Hỗ trợ',
                targetLabel: `Nhóm: ${grp.name}`,
                codeNotation: this.defaultCodeNotation(),
                priority: 'Bình thường',
                dueDate: this.doc()?.dueDate ?? '',
                note: '',
                status: 'Chưa xem',
                members,
                expanded: false,
                groupId: grp.id,
            });
        });

        //Tạo các dòng Cá nhân hỗ trợ được chọn lẻ
        this.tempSupportUserIds().forEach((uid) => {
            const usr = opts.allUsers.find((u) => u.id === uid);
            if (!usr) return;

            supportRows.push({
                key: `SPT_USER_${usr.id}`,
                type: 'USER',
                role: 'Hỗ trợ',
                targetLabel: `${usr.fullName}${usr.departmentName ? ' / ' + usr.departmentName : ''}`,
                codeNotation: this.defaultCodeNotation(),
                priority: 'Bình thường',
                dueDate: this.doc()?.dueDate ?? '',
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

        this.tableRows.set([...nonSupportRows, ...supportRows]);
        this.closePicker();
    }

    //THAO TÁC TRÊN BẢNG DƯỚI & CHIP

    toggleExpandRow(row: DispatchTableRow) {
        row.expanded = !row.expanded;
    }

    removeRow(key: string) {
        const target = this.tableRows().find((r) => r.key === key);
        if (target) {
            if (key.startsWith('SPT_DEPT_')) {
                const deptId = Number(key.replace('SPT_DEPT_', ''));
                const map = new Map(this.tempSupportDeptRoles());
                map.delete(deptId);
                this.tempSupportDeptRoles.set(map);
            } else if (key.startsWith('SPT_GRP_')) {
                const grpId = Number(key.replace('SPT_GRP_', ''));
                const set = new Set(this.tempSupportGroupIds());
                set.delete(grpId);
                this.tempSupportGroupIds.set(set);
            } else if (key.startsWith('SPT_USER_')) {
                const uid = Number(key.replace('SPT_USER_', ''));
                const set = new Set(this.tempSupportUserIds());
                set.delete(uid);
                this.tempSupportUserIds.set(set);
            }
        }
        this.tableRows.set(this.tableRows().filter((r) => r.key !== key));
    }

    //LƯU PHÂN PHỐI

    submitDispatch() {
        this.errorMessage.set('');
        const mainRow = this.mainRows()[0];
        if (!mainRow || mainRow.members.length === 0) {
            this.errorMessage.set('Vui lòng chọn 1 Người nhận chủ trì');
            return;
        }

        const mainAssigneeId = mainRow.members[0].id;

        const supervisorIdSet = new Set<number>();
        this.supervisorRows().forEach((r) => r.members.forEach((m) => supervisorIdSet.add(m.id)));

        const supporterIdSet = new Set<number>();
        let primaryGroupId: number | null = null;
        this.supportRows().forEach((r) => {
            if (r.groupId && !primaryGroupId) {
                primaryGroupId = r.groupId;
            }
            r.members.forEach((m) => supporterIdSet.add(m.id));
        });

        const placesSummary = this.tableRows()
            .map((r) => r.targetLabel)
            .join('; ');

        const payload: IncomingDispatchRequest = {
            mainAssigneeId,
            supervisorIds: Array.from(supervisorIdSet),
            supporterUserIds: Array.from(supporterIdSet),
            primaryTaskGroupId: primaryGroupId,
            toPlacesSummary: placesSummary,
            rows: this.tableRows().map((r) => ({
                key: r.key,
                type: r.type,
                targetLabel: r.targetLabel,
                codeNotation: r.codeNotation,
                roleLabel: r.role,
                priorityLabel: r.priority,
                dueDate: r.dueDate || null,
                note: r.note,
                status: r.status,
                groupId: r.groupId,
                members: r.members,
            })),
        };

        this.submitting.set(true);
        this.docService.dispatchTask(this.docId(), payload).subscribe({
            next: () => {
                this.submitting.set(false);
                this.router.navigate(['/documents/incoming']);
            },
            error: (err) => {
                this.submitting.set(false);
                this.errorMessage.set(err.error?.message ?? 'Phân phối văn bản thất bại');
            },
        });
    }

    private defaultCodeNotation(): string {
        const d = this.doc();
        if (!d) return '—';
        return d.codeNumber || d.codeNotation || String(d.arrivalNumber);
    }
}