import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { DocumentBookResponse, DocumentBookService } from '../../services/document-book.service';
import { DocumentTypeResponse, DocumentTypeService } from '../../services/document-type.service';
import {
    InternalDocumentResponse,
    InternalDocumentService,
} from '../../services/internal-document.service';

@Component({
    selector: 'app-internal-documents',
    imports: [FormsModule, RouterLink],
    templateUrl: './internal-documents.html',
    styleUrl: './internal-documents.css',
})
export class InternalDocuments implements OnInit, OnDestroy {
    // Danh mục lọc
    books = signal<DocumentBookResponse[]>([]);
    types = signal<DocumentTypeResponse[]>([]);

    // Bộ lọc tìm kiếm
    keyword = '';
    selectedBookId: number | null = null;
    selectedTypeId: number | null = null;
    fromDate = '';
    toDate = '';

    // Tìm nâng cao
    showAdvanced = false;
    readonly statusOptions = [
        { value: 'REGISTERED', label: 'Đã đăng ký (Chờ ban hành)' },
        { value: 'ISSUED', label: 'Đã ban hành' },
        { value: 'ARCHIVED', label: 'Đã lưu trữ' },
    ];
    selectedStatus = '';
    selectedPriority: number | null = null;
    signer = '';
    dueFrom = '';
    dueTo = '';
    overdueOnly = false;
    withAttachment = false;

    private keyword$ = new Subject<string>();
    private keywordSub?: Subscription;
    private searchSub?: Subscription;

    // Dữ liệu bảng và phân trang
    documents = signal<InternalDocumentResponse[]>([]);
    loading = signal(false);
    errorMessage = signal('');

    page = signal(0);
    size = signal(10);
    totalElements = signal(0);
    totalPages = signal(0);

    // Hộp thoại xem chi tiết
    viewingDoc = signal<InternalDocumentResponse | null>(null);

    constructor(
        private router: Router,
        private bookService: DocumentBookService,
        private typeService: DocumentTypeService,
        private authService: AuthService,
        public docService: InternalDocumentService
    ) { }

    ngOnInit() {
        this.bookService.findAll().subscribe({ next: (list) => this.books.set(list) });
        this.typeService.findAll().subscribe({ next: (list) => this.types.set(list) });

        this.loadDocuments();

        // Gõ đến đâu tìm đến đó, nhưng chờ 300ms sau khi ngừng gõ để không gửi quá nhiều yêu cầu
        this.keywordSub = this.keyword$
            .pipe(debounceTime(300), distinctUntilChanged())
            .subscribe(() => this.onSearch());
    }

    ngOnDestroy() {
        this.keywordSub?.unsubscribe();
        this.searchSub?.unsubscribe();
    }

    onKeywordInput(value: string) {
        this.keyword = value;
        this.keyword$.next(value);
    }

    onSearch() {
        this.page.set(0);
        this.loadDocuments();
    }

    resetFilters() {
        this.keyword = '';
        this.selectedBookId = null;
        this.selectedTypeId = null;
        this.fromDate = '';
        this.toDate = '';
        this.selectedStatus = '';
        this.selectedPriority = null;
        this.signer = '';
        this.dueFrom = '';
        this.dueTo = '';
        this.overdueOnly = false;
        this.withAttachment = false;
        this.page.set(0);
        this.loadDocuments();
    }

    loadDocuments() {
        this.loading.set(true);
        this.errorMessage.set('');

        this.searchSub?.unsubscribe();   // hủy yêu cầu đang chạy dở để kết quả không về lộn thứ tự
        this.searchSub = this.docService
            .search({
                keyword: this.keyword,
                bookId: this.selectedBookId,
                typeId: this.selectedTypeId,
                status: this.selectedStatus,
                fromDate: this.fromDate,
                toDate: this.toDate,
                priority: this.selectedPriority,
                signer: this.signer,
                dueFrom: this.dueFrom,
                dueTo: this.dueTo,
                overdue: this.overdueOnly,
                hasAttachment: this.withAttachment,
                page: this.page(),
                size: this.size(),
            })
            .subscribe({
                next: (res) => {
                    this.documents.set(res.content ?? []);
                    this.totalElements.set(res.totalElements ?? 0);
                    this.totalPages.set(res.totalPages ?? 0);
                    this.loading.set(false);
                },
                error: (err) => {
                    this.loading.set(false);
                    this.errorMessage.set(err.error?.message ?? 'Không thể tải danh sách văn bản nội bộ');
                },
            });
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

    // --- QUYỀN THAO TÁC (máy chủ cũng kiểm tra lại, đây chỉ để ẩn nút) ---

    canManage(): boolean {
        return this.authService.hasAnyRole(['ADMIN', 'CLERK']);
    }

    // --- THAO TÁC NGHIỆP VỤ ---

    openDetail(doc: InternalDocumentResponse) {
        this.docService.findById(doc.id).subscribe({
            next: (detail) => this.viewingDoc.set(detail),
            error: () => this.viewingDoc.set(doc),
        });
    }

    closeDetail() {
        this.viewingDoc.set(null);
    }

    editDocument(doc: InternalDocumentResponse) {
        this.router.navigate(['/documents/internal', doc.id, 'edit']);
    }

    issueDocument(doc: InternalDocumentResponse) {
        if (!confirm(`Xác nhận ban hành văn bản nội bộ số ${doc.codeNumber}${doc.codeNotation}?`)) {
            return;
        }
        this.docService.issue(doc.id).subscribe({
            next: (updated) => {
                this.loadDocuments();
                if (this.viewingDoc()?.id === doc.id) {
                    this.viewingDoc.set(updated);
                }
            },
            error: (err) => {
                this.errorMessage.set(err.error?.message ?? 'Ban hành văn bản nội bộ thất bại');
            },
        });
    }

    archiveDocument(doc: InternalDocumentResponse) {
        if (!confirm(`Đưa văn bản nội bộ số ${doc.codeNumber}${doc.codeNotation} vào lưu trữ?`)) {
            return;
        }
        this.docService.archive(doc.id).subscribe({
            next: (updated) => {
                this.loadDocuments();
                if (this.viewingDoc()?.id === doc.id) {
                    this.viewingDoc.set(updated);
                }
            },
            error: (err) => {
                this.errorMessage.set(err.error?.message ?? 'Lưu trữ văn bản nội bộ thất bại');
            },
        });
    }

    deleteDocument(doc: InternalDocumentResponse) {
        if (!confirm(`Bạn có chắc chắn muốn xóa văn bản nội bộ số ${doc.codeNumber}${doc.codeNotation}?`)) {
            return;
        }
        this.docService.delete(doc.id).subscribe({
            next: () => {
                this.closeDetail();
                this.loadDocuments();
            },
            error: (err) => {
                this.errorMessage.set(err.error?.message ?? 'Không thể xóa văn bản nội bộ');
            },
        });
    }

    // --- HIỂN THỊ ---

    formatDate(iso: string | null | undefined): string {
        if (!iso) return '—';
        const parts = iso.slice(0, 10).split('-');
        if (parts.length !== 3) return iso;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

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

    isUrgent(p: number | null | undefined): boolean {
        return p !== null && p !== undefined && p > 0;
    }

    priorityLabel(p: number | null | undefined): string {
        switch (p) {
            case 1:
                return 'Khẩn';
            case 2:
                return 'Thượng khẩn';
            case 3:
                return 'Hỏa tốc';
            default:
                return 'Thường';
        }
    }

    statusLabel(status: string): string {
        switch (status) {
            case 'REGISTERED':
                return 'Đã đăng ký (Chờ ban hành)';
            case 'ISSUED':
                return 'Đã ban hành';
            case 'ARCHIVED':
                return 'Đã lưu trữ';
            default:
                return status;
        }
    }
}