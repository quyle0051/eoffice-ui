import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
    DispatchOptionsResponse,
    IncomingDocumentResponse,
    IncomingDocumentService,
    TransferHistoryResponse,
} from '../../services/incoming-document.service';
import {
    DocumentBookResponse,
    DocumentBookService,
} from '../../services/document-book.service';
import {
    DocumentTypeResponse,
    DocumentTypeService,
} from '../../services/document-type.service';
import { AuthService } from '../../services/auth.service';

export type WorkflowActionType =
    | 'SUBMIT_CHIEF'
    | 'FORWARD_DIRECTOR'
    | 'APPROVE_DIRECTOR'
    | 'DISPATCH';

@Component({
    selector: 'app-incoming-documents',
    imports: [FormsModule, RouterLink],
    templateUrl: './incoming-documents.html',
    styleUrl: './incoming-documents.css',
})
export class IncomingDocuments implements OnInit {

    wfTaskGroupId: number | null = null;
    wfSupervisorId: number | null = null;
    wfSupporterId: number | null = null;

    books = signal<DocumentBookResponse[]>([]);
    types = signal<DocumentTypeResponse[]>([]);
    dispatchOptions = signal<DispatchOptionsResponse | null>(null);

    keyword = '';
    selectedBookId: number | null = null;
    selectedTypeId: number | null = null;
    arrivalFrom = '';
    arrivalTo = '';

    documents = signal<IncomingDocumentResponse[]>([]);
    page = signal(0);
    size = signal(10);
    totalElements = signal(0);
    totalPages = signal(0);

    loading = signal(false);
    pageError = signal('');

    // Modal Xem chi tiết + Lịch sử luồng
    selectedDoc = signal<IncomingDocumentResponse | null>(null);
    transferHistory = signal<TransferHistoryResponse[]>([]);

    // Modal Chuyển tiếp / Bút phê / Phân phối
    workflowDoc = signal<IncomingDocumentResponse | null>(null);
    workflowAction = signal<WorkflowActionType>('SUBMIT_CHIEF');
    workflowError = signal('');
    workflowSubmitting = signal(false);

    wfReceiverId: number | null = null;
    wfDirectiveNote = '';
    wfSelectedDeptIds = new Set<number>();
    wfIncludeHead = true;
    wfIncludeDeputy = true;
    wfSelectedGroupIds = new Set<number>();
    wfSelectedUserIds = new Set<number>();

    constructor(
        private docService: IncomingDocumentService,
        private bookService: DocumentBookService,
        private typeService: DocumentTypeService,
        public authService: AuthService,
        private router: Router
    ) { }

    ngOnInit() {
        this.loadFilterMetadata();
        this.loadDocuments();
    }

    loadFilterMetadata() {
        this.bookService.findAll().subscribe({ next: (data) => this.books.set(data) });
        this.typeService.findAll().subscribe({ next: (data) => this.types.set(data) });
        this.docService.getDispatchOptions().subscribe({
            next: (opts) => this.dispatchOptions.set(opts),
        });
    }

    loadDocuments() {
        this.loading.set(true);
        this.pageError.set('');

        this.docService
            .search({
                keyword: this.keyword,
                documentBookId: this.selectedBookId,
                documentTypeId: this.selectedTypeId,
                arrivalFrom: this.arrivalFrom || undefined,
                arrivalTo: this.arrivalTo || undefined,
                page: this.page(),
                size: this.size(),
            })
            .subscribe({
                next: (res) => {
                    this.loading.set(false);
                    if (res) {
                        this.documents.set(res.content ?? []);
                        this.page.set(res.page ?? 0);
                        this.size.set(res.size ?? 10);
                        this.totalElements.set(res.totalElements ?? 0);
                        this.totalPages.set(res.totalPages ?? 0);
                    }
                },
                error: (err) => {
                    this.loading.set(false);
                    this.pageError.set(err.error?.message ?? 'Không thể tải danh sách văn bản đến');
                },
            });
    }

    onSearch() {
        this.page.set(0);
        this.loadDocuments();
    }

    resetFilters() {
        this.keyword = '';
        this.selectedBookId = null;
        this.selectedTypeId = null;
        this.arrivalFrom = '';
        this.arrivalTo = '';
        this.page.set(0);
        this.loadDocuments();
    }

    changePage(newPage: number) {
        if (newPage < 0 || newPage >= this.totalPages()) return;
        this.page.set(newPage);
        this.loadDocuments();
    }

    onSizeChange(newSize: number) {
        this.size.set(Number(newSize));
        this.page.set(0);
        this.loadDocuments();
    }

    viewDetail(doc: IncomingDocumentResponse) {
        this.selectedDoc.set(doc);
        this.transferHistory.set([]);
        this.docService.getHistory(doc.id).subscribe({
            next: (history) => this.transferHistory.set(history),
        });
    }

    closeDetail() {
        this.selectedDoc.set(null);
        this.transferHistory.set([]);
    }

    editDocument(doc: IncomingDocumentResponse) {
        this.router.navigate(['/documents/incoming/new'], {
            queryParams: { id: doc.id },
        });
    }

    deleteDocument(doc: IncomingDocumentResponse) {
        const confirmed = window.confirm(
            `Bạn có chắc chắn muốn xóa văn bản đến số "${doc.arrivalNumber}"?`
        );
        if (!confirmed) return;

        this.docService.delete(doc.id).subscribe({
            next: () => {
                if (this.selectedDoc()?.id === doc.id) this.closeDetail();
                this.loadDocuments();
            },
            error: (err) => {
                this.pageError.set(err.error?.message ?? 'Không thể xóa văn bản đến');
            },
        });
    }

    // --- LOGIC MỞ HỘP THOẠI LUỒNG XỬ LÝ ---

    openWorkflowModal(doc: IncomingDocumentResponse, action: WorkflowActionType) {
        this.workflowDoc.set(doc);
        this.workflowAction.set(action);
        this.workflowError.set('');
        this.wfDirectiveNote = '';
        this.wfSelectedDeptIds.clear();
        this.wfSelectedGroupIds.clear();
        this.wfSelectedUserIds.clear();
        this.wfIncludeHead = true;
        this.wfIncludeDeputy = true;
        // Nếu chưa tải được danh sách Phòng ban / Nhóm công việc thì gọi lại ngay khi mở Modal
        if (!this.dispatchOptions()) {
            this.docService.getDispatchOptions().subscribe({
                next: (opts) => this.dispatchOptions.set(opts),
                error: (err) =>
                    this.workflowError.set(
                        err.error?.message ?? 'Không tải được danh sách Phòng ban / Nhóm công việc'
                    ),
            });
        }
        const opts = this.dispatchOptions();
        if (action === 'SUBMIT_CHIEF') {
            this.wfReceiverId = opts?.officeChiefs?.[0]?.id ?? null;
        } else if (action === 'FORWARD_DIRECTOR') {
            this.wfReceiverId = opts?.directors?.[0]?.id ?? null;
        } else {
            this.wfReceiverId = null;
        }
    }

    closeWorkflowModal() {
        if (this.workflowSubmitting()) return;
        this.workflowDoc.set(null);
    }

    toggleSetItem(set: Set<number>, id: number, checked: boolean) {
        if (checked) {
            set.add(id);
        } else {
            set.delete(id);
        }
    }

    submitWorkflow() {
        const doc = this.workflowDoc();
        if (!doc) return;

        const action = this.workflowAction();
        const payload = {
            receiverId: this.wfReceiverId,
            directiveNote: this.wfDirectiveNote,
            departmentIds: Array.from(this.wfSelectedDeptIds),
            includeHead: this.wfIncludeHead,
            includeDeputy: this.wfIncludeDeputy,
            assigneeIds: Array.from(this.wfSelectedUserIds),
            taskGroupId: this.wfTaskGroupId,
            supervisorId: this.wfSupervisorId,
            supporterId: this.wfSupporterId,
        };

        this.workflowSubmitting.set(true);
        this.workflowError.set('');

        let req$;
        if (action === 'SUBMIT_CHIEF') {
            req$ = this.docService.submitToOfficeChief(doc.id, payload);
        } else if (action === 'FORWARD_DIRECTOR') {
            req$ = this.docService.forwardToDirector(doc.id, payload);
        } else if (action === 'APPROVE_DIRECTOR') {
            req$ = this.docService.approveByDirector(doc.id, payload);
        } else {
            req$ = this.docService.dispatchToHandlers(doc.id, payload);
        }

        req$.subscribe({
            next: () => {
                this.workflowSubmitting.set(false);
                this.workflowDoc.set(null);
                this.loadDocuments();
            },
            error: (err) => {
                this.workflowSubmitting.set(false);
                this.workflowError.set(err.error?.message ?? 'Thao tác chuyển tiếp thất bại');
            },
        });
    }

    // --- HIỂN THỊ NHÃN TRẠNG THÁI & QUYỀN NÚT BẤM ---

    canSubmitChief(doc: IncomingDocumentResponse): boolean {
        const st = doc.status || 'NEW';
        return st === 'NEW' && this.authService.hasAnyRole(['ADMIN', 'CLERK']);
    }

    canForwardDirector(doc: IncomingDocumentResponse): boolean {
        const myEmail = this.authService.user()?.email;
        return (
            doc.status === 'WAITING_OFFICE_CHIEF' &&
            !!myEmail &&
            doc.currentHandlerEmail?.toLowerCase() === myEmail.toLowerCase()
        );
    }

    canApproveDirector(doc: IncomingDocumentResponse): boolean {
        const myEmail = this.authService.user()?.email;
        return (
            doc.status === 'WAITING_DIRECTOR' &&
            !!myEmail &&
            doc.currentHandlerEmail?.toLowerCase() === myEmail.toLowerCase()
        );
    }

    canDispatch(doc: IncomingDocumentResponse): boolean {
        return (
            (doc.status === 'APPROVED_WAITING_DISPATCH' || doc.status === 'DISPATCHED') &&
            this.authService.hasAnyRole(['ADMIN', 'CLERK'])
        );
    }

    canManageDoc(): boolean {
        return this.authService.hasAnyRole(['ADMIN', 'CLERK']);
    }

    statusLabel(status?: string): string {
        switch (status) {
            case 'WAITING_OFFICE_CHIEF':
                return 'Chờ Chánh VP';
            case 'WAITING_DIRECTOR':
                return 'Chờ Giám đốc duyệt';
            case 'APPROVED_WAITING_DISPATCH':
                return 'Đã duyệt - Chờ chuyển';
            case 'DISPATCHED':
                return 'Đã chuyển xử lý';
            case 'COMPLETED':
                return 'Hoàn thành';
            default:
                return 'Mới vào sổ';
        }
    }

    stepLabel(stepType: string): string {
        switch (stepType) {
            case 'TO_OFFICE_CHIEF':
                return 'Văn thư trình Chánh VP';
            case 'TO_DIRECTOR':
                return 'Chánh VP trình Giám đốc';
            case 'RETURN_TO_CLERK':
                return 'Giám đốc bút phê duyệt';
            case 'DISPATCH_TO_HANDLER':
                return 'Văn thư chuyển xử lý';
            default:
                return stepType;
        }
    }

    formatDate(dateStr: string | null | undefined): string {
        if (!dateStr) return '—';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    priorityLabel(priority: number | null | undefined): string {
        if (!priority) return 'Thường';
        if (priority === 1) return 'Khẩn';
        if (priority === 2) return 'Thượng khẩn';
        return `Hỏa tốc (${priority})`;
    }

    isUrgent(priority: number | null | undefined): boolean {
        return priority !== null && priority !== undefined && priority > 0;
    }

    /** Hiển thị Số đến dạng: 6/2023 */
    formatArrivalNumber(doc: IncomingDocumentResponse): string {
        if (doc.arrivalNumber == null) return '—';
        const year = doc.arrivalDate ? doc.arrivalDate.slice(0, 4) : new Date().getFullYear();
        return `${doc.arrivalNumber}/${year}`;
    }

    /** Hiển thị Số, ký hiệu gọn như mẫu */
    formatCode(doc: IncomingDocumentResponse): string {
        if (doc.codeNotation && doc.codeNumber) {
            return doc.codeNotation.includes(doc.codeNumber)
                ? doc.codeNotation
                : `${doc.codeNumber}/${doc.codeNotation}`;
        }
        return doc.codeNotation || doc.codeNumber || '—';
    }

    attachmentUrl(id: number): string {
        return this.docService.getAttachmentUrl(id);
    }
}