import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, of, switchMap, tap } from 'rxjs';
import { DocumentBookResponse, DocumentBookService } from '../../services/document-book.service';
import { DocumentTypeResponse, DocumentTypeService } from '../../services/document-type.service';
import {
    InternalDocumentRequest,
    InternalDocumentResponse,
    InternalDocumentService,
} from '../../services/internal-document.service';

@Component({
    selector: 'app-internal-document-form',
    imports: [FormsModule, RouterLink],
    templateUrl: './internal-document-form.html',
    styleUrl: './internal-document-form.css',
})
export class InternalDocumentForm implements OnInit {
    books = signal<DocumentBookResponse[]>([]);
    types = signal<DocumentTypeResponse[]>([]);

    editingId = signal<number | null>(null);
    isEditMode = computed(() => this.editingId() !== null);

    // Hiển thị: số văn bản và cơ quan do hệ thống cấp, người dùng không sửa
    codeNumber = signal('');
    organName = signal('');
    existingAttachmentName = signal<string | null>(null);

    /** true khi văn bản đã ban hành hoặc lưu trữ: không còn sửa được. */
    locked = signal(false);

    loading = signal(false);
    submitting = signal(false);
    errorMessage = signal('');

    // Dữ liệu nhập
    documentBookId: number | null = null;
    documentTypeId: number | null = null;
    codeNotation = '';
    issuedDate = this.todayIso();
    dueDate = '';
    priority = 0;
    issuedAmount = 1;
    subject = '';
    language = 'Tiếng Việt';
    pageAmount = 1;
    description = '';
    signerPosition = '';
    signerFullName = '';

    // Tệp đính kèm
    selectedFile: File | null = null;

    /** Người dùng đã tự sửa ký hiệu thì không ghi đè bằng gợi ý nữa. */
    notationTouched = false;

    /** Đã lưu văn bản nhưng tải tệp lỗi: lần bấm tiếp theo chỉ tải lại tệp, không lưu lần nữa. */
    private pendingUploadId: number | null = null;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        public docService: InternalDocumentService,
        private bookService: DocumentBookService,
        private typeService: DocumentTypeService
    ) { }

    ngOnInit() {
        this.bookService.findAll().subscribe({ next: (list) => this.books.set(list) });
        this.typeService.findAll().subscribe({ next: (list) => this.types.set(list) });

        const idParam = this.route.snapshot.paramMap.get('id');
        if (idParam && !isNaN(Number(idParam))) {
            const id = Number(idParam);
            this.editingId.set(id);
            this.loadDocument(id);
        } else {
            this.refreshNumbering();
        }
    }

    private loadDocument(id: number) {
        this.loading.set(true);
        this.errorMessage.set('');
        this.docService.findById(id).subscribe({
            next: (doc) => {
                this.fillForm(doc);
                this.loading.set(false);
                if (doc.status !== 'REGISTERED') {
                    this.locked.set(true);
                    this.errorMessage.set('Văn bản đã ban hành hoặc đã lưu trữ nên không thể sửa.');
                }
            },
            error: (err) => {
                this.loading.set(false);
                this.errorMessage.set(err.error?.message ?? 'Không tìm thấy văn bản nội bộ');
            },
        });
    }

    private fillForm(doc: InternalDocumentResponse) {
        this.documentBookId = doc.documentBookId;
        this.documentTypeId = doc.documentTypeId;
        this.codeNumber.set(doc.codeNumber);
        this.organName.set(doc.organName);
        this.codeNotation = doc.codeNotation;
        this.notationTouched = true;
        this.issuedDate = doc.issuedDate;
        this.dueDate = doc.dueDate ?? '';
        this.priority = doc.priority ?? 0;
        this.issuedAmount = doc.issuedAmount ?? 1;
        this.subject = doc.subject;
        this.language = doc.language ?? 'Tiếng Việt';
        this.pageAmount = doc.pageAmount ?? 1;
        this.description = doc.description ?? '';
        this.signerPosition = doc.signerPosition ?? '';
        this.signerFullName = doc.signerFullName ?? '';
        this.existingAttachmentName.set(doc.attachmentName ?? null);
    }

    /** Khi đổi sổ, loại văn bản hoặc ngày ban hành thì xin lại số và ký hiệu gợi ý. */
    onNumberingChange() {
        if (!this.isEditMode()) {
            this.refreshNumbering();
        }
    }

    private refreshNumbering() {
        this.docService
            .nextInfo(this.documentBookId, this.documentTypeId, this.issuedDate || null)
            .subscribe({
                next: (info) => {
                    this.organName.set(info.organName);
                    if (this.isEditMode()) return;
                    // Chưa chọn sổ thì chưa có số để hiển thị
                    this.codeNumber.set(this.documentBookId ? info.codeNumber : '');
                    if (!this.notationTouched) {
                        this.codeNotation = info.codeNotation;
                    }
                },
            });
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
    }

    /** @param issueImmediately true = đăng ký và ban hành ngay */
    saveDocument(issueImmediately: boolean) {
        this.errorMessage.set('');

        // Lần trước đã lưu văn bản nhưng tải tệp bị lỗi: chỉ tải lại tệp
        if (this.pendingUploadId !== null && this.selectedFile) {
            this.submitting.set(true);
            this.docService.uploadAttachment(this.pendingUploadId, this.selectedFile).subscribe({
                next: () => {
                    this.submitting.set(false);
                    this.router.navigate(['/documents/internal']);
                },
                error: (err) => {
                    this.submitting.set(false);
                    this.errorMessage.set(err.error?.message ?? 'Tải tệp đính kèm thất bại, vui lòng thử lại');
                },
            });
            return;
        }

        if (!this.documentBookId) {
            this.errorMessage.set('Vui lòng chọn sổ văn bản');
            return;
        }
        if (!this.documentTypeId) {
            this.errorMessage.set('Vui lòng chọn loại văn bản');
            return;
        }
        if (!this.codeNotation.trim()) {
            this.errorMessage.set('Ký hiệu văn bản không được để trống');
            return;
        }
        if (!this.issuedDate) {
            this.errorMessage.set('Vui lòng chọn ngày ban hành');
            return;
        }
        if (!this.subject.trim()) {
            this.errorMessage.set('Trích yếu không được để trống');
            return;
        }
        if (this.dueDate && this.dueDate < this.issuedDate) {
            this.errorMessage.set('Hạn xử lý không được trước ngày ban hành');
            return;
        }

        const payload: InternalDocumentRequest = {
            documentBookId: Number(this.documentBookId),
            documentTypeId: Number(this.documentTypeId),
            codeNotation: this.codeNotation.trim(),
            issuedDate: this.issuedDate,
            subject: this.subject.trim(),
            language: this.clean(this.language),
            pageAmount: this.pageAmount != null ? Number(this.pageAmount) : 1,
            description: this.clean(this.description),
            signerPosition: this.clean(this.signerPosition),
            signerFullName: this.clean(this.signerFullName),
            priority: this.priority != null ? Number(this.priority) : 0,
            issuedAmount: this.issuedAmount != null ? Number(this.issuedAmount) : 1,
            dueDate: this.dueDate || null,
            issueImmediately,
        };

        this.submitting.set(true);
        const id = this.editingId();
        const save$: Observable<InternalDocumentResponse> = id
            ? this.docService.update(id, payload)
            : this.docService.create(payload);

        save$
            .pipe(
                tap((saved) => {
                    // Đã lưu xong: nếu bước sau lỗi thì bấm lại sẽ không tạo thêm văn bản trùng
                    this.pendingUploadId = this.selectedFile ? saved.id : null;
                    this.editingId.set(saved.id);
                    this.codeNumber.set(saved.codeNumber);
                }),
                switchMap((saved) =>
                    this.selectedFile
                        ? this.docService.uploadAttachment(saved.id, this.selectedFile)
                        : of(saved)
                )
            )
            .subscribe({
                next: () => {
                    this.submitting.set(false);
                    this.router.navigate(['/documents/internal']);
                },
                error: (err) => {
                    this.submitting.set(false);
                    if (this.pendingUploadId !== null) {
                        this.errorMessage.set(
                            'Văn bản đã được lưu nhưng tải tệp đính kèm bị lỗi: ' +
                            (err.error?.message ?? 'không rõ nguyên nhân') +
                            '. Bấm lưu lần nữa để thử tải lại tệp.'
                        );
                    } else {
                        this.errorMessage.set(err.error?.message ?? 'Lưu văn bản nội bộ thất bại');
                    }
                },
            });
    }

    private clean(value: string): string | null {
        const trimmed = (value ?? '').trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    private todayIso(): string {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 10);
    }
}