import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DocumentBookResponse, DocumentBookService } from '../../services/document-book.service';
import { DocumentTypeResponse, DocumentTypeService } from '../../services/document-type.service';
import {
    OutgoingDocumentResponse,
    OutgoingDocumentService,
} from '../../services/outgoing-document.service';

@Component({
    selector: 'app-outgoing-documents',
    imports: [FormsModule, RouterLink],
    templateUrl: './outgoing-documents.html',
    styleUrl: './outgoing-documents.css',
})
export class OutgoingDocuments implements OnInit {
    // Danh mục lọc
    books = signal<DocumentBookResponse[]>([]);
    types = signal<DocumentTypeResponse[]>([]);

    // Bộ lọc tìm kiếm
    keyword = '';
    selectedBookId: number | null = null;
    selectedTypeId: number | null = null;
    selectedStatus = '';
    fromDate = '';
    toDate = '';

    // Dữ liệu bảng & phân trang
    documents = signal<OutgoingDocumentResponse[]>([]);
    loading = signal(false);
    errorMessage = signal('');

    page = signal(0);
    size = signal(10);
    totalElements = signal(0);
    totalPages = signal(0);

    // Modal xem chi tiết văn bản đi (16 trường chuẩn)
    viewingDoc = signal<OutgoingDocumentResponse | null>(null);

    constructor(
        private router: Router,
        private bookService: DocumentBookService,
        private typeService: DocumentTypeService,
        public outgoingService: OutgoingDocumentService
    ) { }

    ngOnInit() {
        this.bookService.findAll().subscribe({
            next: (allBooks) => {
                const outBooks = allBooks.filter((b: any) => !b.type || b.type === 'OUTGOING');
                this.books.set(outBooks.length > 0 ? outBooks : allBooks);
            },
        });

        this.typeService.findAll().subscribe({
            next: (list) => this.types.set(list),
        });

        this.loadDocuments();
    }

    onSearch() {
        this.page.set(0);
        this.loadDocuments();
    }

    resetFilters() {
        this.keyword = '';
        this.selectedBookId = null;
        this.selectedTypeId = null;
        this.selectedStatus = '';
        this.fromDate = '';
        this.toDate = '';
        this.page.set(0);
        this.loadDocuments();
    }

    loadDocuments() {
        this.loading.set(true);
        this.errorMessage.set('');

        this.outgoingService
            .search({
                keyword: this.keyword,
                bookId: this.selectedBookId,
                typeId: this.selectedTypeId,
                status: this.selectedStatus,
                fromDate: this.fromDate,
                toDate: this.toDate,
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
                    this.errorMessage.set(err.error?.message ?? 'Không thể tải danh sách văn bản đi');
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

    // --- CÁC THAO TÁC NGHIỆP VỤ VĂN BẢN ĐI ---

    openDetail(doc: OutgoingDocumentResponse) {
        this.outgoingService.findById(doc.id).subscribe({
            next: (detail) => this.viewingDoc.set(detail),
            error: () => this.viewingDoc.set(doc),
        });
    }

    closeDetail() {
        this.viewingDoc.set(null);
    }

    editDocument(doc: OutgoingDocumentResponse) {
        this.router.navigate(['/documents/outgoing', doc.id, 'edit']);
    }

    /** Chức năng 5: Phát hành văn bản đi (1 click, không cần theo dõi trạng thái từng nơi nhận) */
    issueDocument(doc: OutgoingDocumentResponse) {
        if (!confirm(`Xác nhận phát hành văn bản đi số ${doc.codeNumber}${doc.codeNotation}?`)) {
            return;
        }
        this.outgoingService.issue(doc.id).subscribe({
            next: (updated) => {
                this.loadDocuments();
                if (this.viewingDoc()?.id === doc.id) {
                    this.viewingDoc.set(updated);
                }
            },
            error: (err) => {
                this.errorMessage.set(err.error?.message ?? 'Phát hành văn bản đi thất bại');
            },
        });
    }

    /** Lưu trữ văn bản đi */
    archiveDocument(doc: OutgoingDocumentResponse) {
        if (!confirm(`Đưa văn bản đi số ${doc.codeNumber}${doc.codeNotation} vào lưu trữ?`)) {
            return;
        }
        this.outgoingService.archive(doc.id).subscribe({
            next: (updated) => {
                this.loadDocuments();
                if (this.viewingDoc()?.id === doc.id) {
                    this.viewingDoc.set(updated);
                }
            },
            error: (err) => {
                this.errorMessage.set(err.error?.message ?? 'Lưu trữ văn bản đi thất bại');
            },
        });
    }

    deleteDocument(doc: OutgoingDocumentResponse) {
        if (!confirm(`Bạn có chắc chắn muốn xóa văn bản đi số ${doc.codeNumber}${doc.codeNotation}?`)) {
            return;
        }
        this.outgoingService.delete(doc.id).subscribe({
            next: () => {
                this.closeDetail();
                this.loadDocuments();
            },
            error: (err) => {
                this.errorMessage.set(err.error?.message ?? 'Không thể xóa văn bản đi');
            },
        });
    }

    // --- CÁC HÀM HIỂN THỊ ---

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

    priorityLabel(p: number): string {
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
                return 'Đã cấp số (Chờ phát hành)';
            case 'ISSUED':
                return 'Đã phát hành';
            case 'ARCHIVED':
                return 'Đã lưu trữ';
            default:
                return status;
        }
    }
}