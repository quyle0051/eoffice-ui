import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
    DocumentBookRequest,
    DocumentBookResponse,
    DocumentBookService,
} from '../../services/document-book.service';

@Component({
    selector: 'app-document-books',
    imports: [FormsModule, RouterLink],
    templateUrl: './document-books.html',
    styleUrl: './document-books.css',
})
export class DocumentBooks implements OnInit {
    books = signal<DocumentBookResponse[]>([]);
    loading = signal(false);
    keyword = signal('');
    pageError = signal('');

    // Trạng thái Modal Thêm/Sửa
    showModal = signal(false);
    submitting = signal(false);
    editingId = signal<number | null>(null);
    modalError = signal('');

    // Dữ liệu form
    formName = '';
    formShortName = '';
    formStandardDays: number | null = null;
    formParentId: number | null = null;

    // Danh sách đã lọc theo từ khóa
    filteredBooks = computed(() => {
        const kw = this.keyword().trim().toLowerCase();
        if (!kw) return this.books();
        return this.books().filter(
            (b) =>
                b.name.toLowerCase().includes(kw) ||
                (b.shortName && b.shortName.toLowerCase().includes(kw)) ||
                (b.parentName && b.parentName.toLowerCase().includes(kw))
        );
    });

    // Danh sách sổ cha hợp lệ (không bao gồm chính sổ đang sửa)
    parentOptions = computed(() => {
        const currentId = this.editingId();
        return this.books().filter((b) => b.id !== currentId);
    });

    constructor(private bookService: DocumentBookService) { }

    ngOnInit() {
        this.loadBooks();
    }

    loadBooks() {
        this.loading.set(true);
        this.pageError.set('');
        this.bookService.findAll().subscribe({
            next: (data) => {
                this.books.set(data);
                this.loading.set(false);
            },
            error: (err) => {
                this.loading.set(false);
                this.pageError.set(err.error?.message ?? 'Không thể tải danh sách sổ văn bản');
            },
        });
    }

    openCreateModal() {
        this.editingId.set(null);
        this.formName = '';
        this.formShortName = '';
        this.formStandardDays = null;
        this.formParentId = null;
        this.modalError.set('');
        this.showModal.set(true);
    }

    openEditModal(book: DocumentBookResponse) {
        this.editingId.set(book.id);
        this.formName = book.name;
        this.formShortName = book.shortName ?? '';
        this.formStandardDays = book.standardDays;
        this.formParentId = book.parentId;
        this.modalError.set('');
        this.showModal.set(true);
    }

    closeModal() {
        if (this.submitting()) return;
        this.showModal.set(false);
    }

    saveBook() {
        const trimmedName = this.formName.trim();
        if (!trimmedName) {
            this.modalError.set('Tên sổ không được để trống');
            return;
        }

        const payload: DocumentBookRequest = {
            name: trimmedName,
            shortName: this.formShortName.trim() ? this.formShortName.trim() : null,
            standardDays: this.formStandardDays !== null && this.formStandardDays !== undefined
                ? Number(this.formStandardDays)
                : null,
            parentId: this.formParentId ? Number(this.formParentId) : null,
        };

        this.submitting.set(true);
        this.modalError.set('');

        const id = this.editingId();
        const request$ = id
            ? this.bookService.update(id, payload)
            : this.bookService.create(payload);

        request$.subscribe({
            next: () => {
                this.submitting.set(false);
                this.showModal.set(false);
                this.loadBooks();
            },
            error: (err) => {
                this.submitting.set(false);
                this.modalError.set(err.error?.message ?? 'Lưu sổ văn bản thất bại');
            },
        });
    }

    deleteBook(book: DocumentBookResponse) {
        const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa sổ "${book.name}"?`);
        if (!confirmed) return;

        this.pageError.set('');
        this.bookService.delete(book.id).subscribe({
            next: () => this.loadBooks(),
            error: (err) => {
                this.pageError.set(err.error?.message ?? 'Không thể xóa sổ văn bản');
            },
        });
    }
}