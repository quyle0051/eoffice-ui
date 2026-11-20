import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DocumentBookResponse, DocumentBookService } from '../../services/document-book.service';
import { DocumentTypeResponse, DocumentTypeService } from '../../services/document-type.service';
import {
    OrganItem,
    OutgoingDocumentRequest,
    OutgoingDocumentService,
    OutgoingRecipientItem,
} from '../../services/outgoing-document.service';

@Component({
    selector: 'app-outgoing-document-form',
    imports: [FormsModule, RouterLink],
    templateUrl: './outgoing-document-form.html',
    styleUrl: './outgoing-document-form.css',
})
export class OutgoingDocumentForm implements OnInit {
    editId = signal<number | null>(null);
    books = signal<DocumentBookResponse[]>([]);
    types = signal<DocumentTypeResponse[]>([]);
    organs = signal<OrganItem[]>([]);

    loading = signal(false);
    submitting = signal(false);
    errorMessage = signal('');

    documentBookId: number | null = null;
    documentTypeId: number | null = null;
    codeNumber = '';
    codeNotation = '';
    issuedDate = this.todayIso();
    organName = 'Văn phòng Điện tử E-Office';
    subject = '';
    language = 'Tiếng Việt';
    pageAmount = 1;
    description = '';

    signerPosition = 'Giám đốc';
    signerFullName = '';

    priority = 0;
    issuedAmount = 1;
    dueDate = '';

    // Danh sách nơi nhận bên ngoài (Mục 13.1 & 13.2)
    recipients = signal<OutgoingRecipientItem[]>([]);
    selectedOrganPresetId: number | null = null;
    newRecOrganId = '';
    newRecOrganName = '';
    newRecCopies = 1;
    newRecMethod = 'TRUC_LIEN_THONG';

    // Tệp đính kèm
    selectedFile: File | null = null;
    existingAttachmentName = signal<string | null>(null);

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private bookService: DocumentBookService,
        private typeService: DocumentTypeService,
        public outgoingService: OutgoingDocumentService
    ) { }

    ngOnInit() {
        const idParam = this.route.snapshot.paramMap.get('id');
        if (idParam) {
            this.editId.set(Number(idParam));
        }

        // Lọc các Sổ văn bản đi (hoặc lấy tất cả sổ nếu chưa phân loại)
        this.bookService.findAll().subscribe({
            next: (allBooks) => {
                const outBooks = allBooks.filter((b: any) => !b.type || b.type === 'OUTGOING');
                const list = outBooks.length > 0 ? outBooks : allBooks;
                this.books.set(list);
                if (!this.editId() && list.length > 0) {
                    this.documentBookId = list[0].id;
                    this.refreshSuggestedNumber();
                }
            },
        });

        this.typeService.findAll().subscribe({
            next: (list) => {
                this.types.set(list);
                if (!this.editId() && list.length > 0) {
                    this.documentTypeId = list[0].id;
                    this.refreshSuggestedNumber();
                }
            },
        });

        this.outgoingService.getOrgans().subscribe({
            next: (list) => this.organs.set(list),
        });

        if (this.editId()) {
            this.loadExisting(this.editId()!);
        }
    }

    loadExisting(id: number) {
        this.loading.set(true);
        this.outgoingService.findById(id).subscribe({
            next: (doc) => {
                this.documentBookId = doc.documentBookId;
                this.documentTypeId = doc.documentTypeId;
                this.codeNumber = doc.codeNumber;
                this.codeNotation = doc.codeNotation;
                this.issuedDate = doc.issuedDate;
                this.organName = doc.organName;
                this.subject = doc.subject;
                this.language = doc.language || 'Tiếng Việt';
                this.pageAmount = doc.pageAmount || 1;
                this.description = doc.description ?? '';
                this.signerPosition = doc.signerPosition ?? '';
                this.signerFullName = doc.signerFullName ?? '';
                this.priority = doc.priority ?? 0;
                this.issuedAmount = doc.issuedAmount ?? 1;
                this.dueDate = doc.dueDate ?? '';
                this.recipients.set(doc.recipients ?? []);
                this.existingAttachmentName.set(doc.attachmentName ?? null);
                this.loading.set(false);
            },
            error: (err) => {
                this.loading.set(false);
                this.errorMessage.set(err.error?.message ?? 'Không tải được thông tin văn bản đi');
            },
        });
    }

    onBookOrTypeChange() {
        if (!this.editId()) {
            this.refreshSuggestedNumber();
        }
    }

    refreshSuggestedNumber() {
        if (!this.documentBookId) return;
        this.outgoingService.suggestNextNumber(this.documentBookId, this.documentTypeId).subscribe({
            next: (res) => {
                this.codeNumber = res.codeNumber;
                this.codeNotation = res.codeNotation;
            },
        });
    }

    onSelectPresetOrgan(organDbId: number | null) {
        if (!organDbId) return;
        const found = this.organs().find((o) => o.id === Number(organDbId));
        if (found) {
            this.newRecOrganId = found.organId;
            this.newRecOrganName = found.organName;
        }
    }

    addRecipient() {
        if (!this.newRecOrganName.trim()) {
            this.errorMessage.set('Vui lòng nhập hoặc chọn Tên cơ quan nhận văn bản (Mục 13.2)');
            return;
        }
        const item: OutgoingRecipientItem = {
            organId: this.newRecOrganId.trim() || '000.00.00.000',
            organName: this.newRecOrganName.trim(),
            copies: this.newRecCopies > 0 ? this.newRecCopies : 1,
            deliveryMethod: this.newRecMethod,
        };
        const nextList = [...this.recipients(), item];
        this.recipients.set(nextList);
        this.recalcIssuedAmount(nextList);

        this.selectedOrganPresetId = null;
        this.newRecOrganId = '';
        this.newRecOrganName = '';
        this.newRecCopies = 1;
    }

    removeRecipient(index: number) {
        const nextList = this.recipients().filter((_, i) => i !== index);
        this.recipients.set(nextList);
        this.recalcIssuedAmount(nextList);
    }

    private recalcIssuedAmount(list: OutgoingRecipientItem[]) {
        const sum = list.reduce((acc, r) => acc + (Number(r.copies) || 1), 0);
        if (sum > 0) {
            this.issuedAmount = sum;
        }
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.selectedFile = input.files[0];
        }
    }

    save(issueImmediately: boolean) {
        this.errorMessage.set('');
        if (!this.documentBookId || !this.documentTypeId) {
            this.errorMessage.set('Vui lòng chọn Sổ văn bản đi và Loại văn bản');
            return;
        }
        if (!this.codeNumber.trim() || !this.codeNotation.trim() || !this.subject.trim()) {
            this.errorMessage.set('Vui lòng nhập đầy đủ Số văn bản, Ký hiệu và Trích yếu nội dung');
            return;
        }

        const payload: OutgoingDocumentRequest = {
            documentBookId: this.documentBookId,
            documentTypeId: this.documentTypeId,
            codeNumber: this.codeNumber.trim(),
            codeNotation: this.codeNotation.trim(),
            issuedDate: this.issuedDate,
            organName: this.organName.trim(),
            subject: this.subject.trim(),
            language: this.language.trim() || 'Tiếng Việt',
            pageAmount: this.pageAmount,
            description: this.description.trim(),
            signerPosition: this.signerPosition.trim(),
            signerFullName: this.signerFullName.trim(),
            recipients: this.recipients(),
            priority: Number(this.priority),
            issuedAmount: Number(this.issuedAmount) || 1,
            dueDate: this.dueDate || null,
            issueImmediately,
        };

        this.submitting.set(true);
        const req$ = this.editId()
            ? this.outgoingService.update(this.editId()!, payload)
            : this.outgoingService.create(payload);

        req$.subscribe({
            next: (saved) => {
                if (this.selectedFile) {
                    this.outgoingService.uploadAttachment(saved.id, this.selectedFile).subscribe({
                        next: () => {
                            this.submitting.set(false);
                            this.router.navigate(['/documents/outgoing']);
                        },
                        error: () => {
                            this.submitting.set(false);
                            this.router.navigate(['/documents/outgoing']);
                        },
                    });
                } else {
                    this.submitting.set(false);
                    this.router.navigate(['/documents/outgoing']);
                }
            },
            error: (err) => {
                this.submitting.set(false);
                this.errorMessage.set(err.error?.message ?? 'Lưu văn bản đi thất bại');
            },
        });
    }

    private todayIso(): string {
        return new Date().toISOString().slice(0, 10);
    }
}