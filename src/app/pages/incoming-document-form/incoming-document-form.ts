import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import {
    DispatchOptionsResponse,
    IncomingDocumentRequest,
    IncomingDocumentResponse,
    IncomingDocumentService,
} from '../../services/incoming-document.service';
import {
    DocumentBookResponse,
    DocumentBookService,
} from '../../services/document-book.service';
import {
    DocumentTypeResponse,
    DocumentTypeService,
} from '../../services/document-type.service';

@Component({
    selector: 'app-incoming-document-form',
    imports: [FormsModule, RouterLink],
    templateUrl: './incoming-document-form.html',
    styleUrl: './incoming-document-form.css',
})
export class IncomingDocumentForm implements OnInit {
    books = signal<DocumentBookResponse[]>([]);
    types = signal<DocumentTypeResponse[]>([]);
    officeChiefs = signal<{ id: number; fullName: string; email: string }[]>([]);

    editingId = signal<number | null>(null);
    arrivalNumber = signal<number | null>(null);
    originalArrivalYear = signal<number | null>(null);
    existingAttachmentName = signal<string | null>(null);

    loading = signal(false);
    submitting = signal(false);
    errorMessage = signal('');

    isEditMode = computed(() => this.editingId() !== null);

    // Dữ liệu văn bản
    documentBookId: number | null = null;
    documentTypeId: number | null = null;
    subject = '';
    codeNumber = '';
    codeNotation = '';
    issuedDate = '';
    organName = '';
    language = 'Tiếng Việt';
    pageAmount: number | null = 1;
    docOrdinal: number | null = null;
    description = '';
    arrivalDate = this.todayIso();
    signerPosition = '';
    signerFullName = '';
    priority: number | null = 0;
    toPlaces = '';
    traceHeaderList = '';
    dueDate = '';

    // File đính kèm & Chuyển Chánh văn phòng
    selectedFile: File | null = null;
    selectedChiefId: number | null = null;
    chiefDirectiveNote = '';

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        public docService: IncomingDocumentService,
        private bookService: DocumentBookService,
        private typeService: DocumentTypeService
    ) { }

    ngOnInit() {
        this.loadMetadata();

        this.route.queryParamMap.subscribe((params) => {
            const idParam = params.get('id');
            if (idParam && !isNaN(Number(idParam))) {
                const id = Number(idParam);
                this.editingId.set(id);
                this.loadDocument(id);
            } else {
                this.editingId.set(null);
                this.resetFormToDefault();
            }
        });
    }

    loadMetadata() {
        this.bookService.findAll('INCOMING').subscribe({
            next: (data) => this.books.set(data),
        });
        this.typeService.findAll().subscribe({
            next: (data) => this.types.set(data),
        });
        this.docService.getDispatchOptions().subscribe({
            next: (opts: DispatchOptionsResponse) => {
                const chiefs = opts.officeChiefs ?? [];
                this.officeChiefs.set(chiefs);
                if (chiefs.length > 0 && !this.selectedChiefId) {
                    this.selectedChiefId = chiefs[0].id;
                }
            },
        });
    }

    loadDocument(id: number) {
        this.loading.set(true);
        this.errorMessage.set('');

        this.docService.findById(id).subscribe({
            next: (doc) => {
                this.loading.set(false);
                this.documentBookId = doc.documentBookId;
                this.documentTypeId = doc.documentTypeId;
                this.arrivalNumber.set(doc.arrivalNumber);
                this.existingAttachmentName.set(doc.attachmentName ?? null);

                this.subject = doc.subject ?? '';
                this.codeNumber = doc.codeNumber ?? '';
                this.codeNotation = doc.codeNotation ?? '';
                this.issuedDate = doc.issuedDate ?? '';
                this.organName = doc.organName ?? '';
                this.language = doc.language ?? 'Tiếng Việt';
                this.pageAmount = doc.pageAmount;
                this.docOrdinal = doc.docOrdinal;
                this.description = doc.description ?? '';
                this.arrivalDate = doc.arrivalDate ?? '';
                this.signerPosition = doc.signerPosition ?? '';
                this.signerFullName = doc.signerFullName ?? '';
                this.priority = doc.priority ?? 0;
                this.toPlaces = doc.toPlaces ?? '';
                this.traceHeaderList = doc.traceHeaderList ?? '';
                this.dueDate = doc.dueDate ?? '';

                if (doc.arrivalDate) {
                    this.originalArrivalYear.set(new Date(doc.arrivalDate).getFullYear());
                }
            },
            error: (err) => {
                this.loading.set(false);
                this.errorMessage.set(err.error?.message ?? 'Không tìm thấy văn bản đến');
            },
        });
    }

    resetFormToDefault() {
        this.arrivalNumber.set(null);
        this.originalArrivalYear.set(null);
        this.existingAttachmentName.set(null);
        this.selectedFile = null;
        this.documentBookId = null;
        this.documentTypeId = null;
        this.subject = '';
        this.codeNumber = '';
        this.codeNotation = '';
        this.issuedDate = '';
        this.organName = '';
        this.language = 'Tiếng Việt';
        this.pageAmount = 1;
        this.docOrdinal = null;
        this.description = '';
        this.arrivalDate = this.todayIso();
        this.signerPosition = '';
        this.signerFullName = '';
        this.priority = 0;
        this.toPlaces = '';
        this.traceHeaderList = '';
        this.dueDate = '';
        this.chiefDirectiveNote = '';
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.selectedFile = input.files[0];
        } else {
            this.selectedFile = null;
        }
    }

    // onBookOrArrivalDateChange() {
    //     if (this.isEditMode() || this.dueDate) return;
    //     const book = this.books().find((b) => b.id === Number(this.documentBookId));
    //     if (book && book.standardDays != null && this.arrivalDate) {
    //         const baseDate = new Date(this.arrivalDate);
    //         baseDate.setDate(baseDate.getDate() + book.standardDays);
    //         this.dueDate = baseDate.toISOString().slice(0, 10);
    //     }
    // }

    /**
     * @param forwardToLeader true = Lưu vào sổ VÀ trình Chánh văn phòng luôn
     */
    saveDocument(forwardToLeader: boolean) {
        this.errorMessage.set('');

        if (!this.documentBookId) {
            this.errorMessage.set('Vui lòng chọn sổ văn bản');
            return;
        }
        if (!this.documentTypeId) {
            this.errorMessage.set('Vui lòng chọn loại văn bản');
            return;
        }
        if (!this.subject || !this.subject.trim()) {
            this.errorMessage.set('Trích yếu không được để trống');
            return;
        }
        if (forwardToLeader && !this.selectedChiefId) {
            this.errorMessage.set('Vui lòng chọn Chánh văn phòng để chuyển văn bản');
            return;
        }

        const effectiveArrival = this.arrivalDate || this.todayIso();
        if (this.issuedDate && this.issuedDate > effectiveArrival) {
            this.errorMessage.set('Ngày ban hành không được sau ngày đến');
            return;
        }
        if (this.dueDate && this.dueDate < effectiveArrival) {
            this.errorMessage.set('Hạn giải quyết không được trước ngày đến');
            return;
        }

        const payload: IncomingDocumentRequest = {
            documentBookId: Number(this.documentBookId),
            documentTypeId: Number(this.documentTypeId),
            subject: this.subject.trim(),
            codeNumber: this.cleanStr(this.codeNumber),
            codeNotation: this.cleanStr(this.codeNotation),
            issuedDate: this.issuedDate || null,
            organName: this.cleanStr(this.organName),
            language: this.cleanStr(this.language),
            pageAmount: this.pageAmount != null ? Number(this.pageAmount) : null,
            docOrdinal: this.docOrdinal != null ? Number(this.docOrdinal) : null,
            description: this.cleanStr(this.description),
            arrivalDate: this.arrivalDate || null,
            signerPosition: this.cleanStr(this.signerPosition),
            signerFullName: this.cleanStr(this.signerFullName),
            priority: this.priority != null ? Number(this.priority) : 0,
            toPlaces: this.cleanStr(this.toPlaces),
            traceHeaderList: this.cleanStr(this.traceHeaderList),
            dueDate: this.dueDate || null,
        };

        this.submitting.set(true);
        const id = this.editingId();
        const save$: Observable<IncomingDocumentResponse> = id
            ? this.docService.update(id, payload)
            : this.docService.create(payload);

        save$
            .pipe(
                // Nếu có chọn file đính kèm thì upload lên
                switchMap((savedDoc) => {
                    if (this.selectedFile) {
                        return this.docService.uploadAttachment(savedDoc.id, this.selectedFile);
                    }
                    return of(savedDoc);
                }),
                //Nếu bấm "Lưu & Chuyển lãnh đạo" thì gọi API trình Chánh văn phòng luôn
                switchMap((savedDoc) => {
                    if (forwardToLeader) {
                        return this.docService.submitToOfficeChief(savedDoc.id, {
                            receiverId: this.selectedChiefId,
                            directiveNote: this.chiefDirectiveNote,
                        });
                    }
                    return of(savedDoc);
                })
            )
            .subscribe({
                next: () => {
                    this.submitting.set(false);
                    this.router.navigate(['/documents/incoming']);
                },
                error: (err) => {
                    this.submitting.set(false);
                    this.errorMessage.set(err.error?.message ?? 'Lưu văn bản đến thất bại');
                },
            });
    }

    private cleanStr(val: string): string | null {
        const trimmed = (val ?? '').trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    private todayIso(): string {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 10);
    }
}