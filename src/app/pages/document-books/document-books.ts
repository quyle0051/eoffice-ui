import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
    DocumentBookRequest,
    DocumentBookResponse,
    DocumentBookService,
    DocumentBookTypeResponse,
} from '../../services/document-book.service';

@Component({
    selector: 'app-document-books',
    imports: [FormsModule, RouterLink],
    templateUrl: './document-books.html',
    styleUrl: './document-books.css',
})
export class DocumentBooks implements OnInit {
    books = signal<DocumentBookResponse[]>([]);
    bookTypes = signal<DocumentBookTypeResponse[]>([]);
    loading = signal(false);
    keyword = signal('');
    pageError = signal('');
    typeFilter = signal('');

    // Trạng thái Modal Thêm/Sửa
    showModal = signal(false);
    submitting = signal(false);
    editingId = signal<number | null>(null);
    modalError = signal('');

    // Dữ liệu form
    formName = '';
    formShortName = '';
    formBookTypeId: number | null = null;
    formParentId: number | null = null;

    // Danh sách đã lọc theo từ khóa
    filteredBooks = computed(() => {
        const kw = this.keyword().trim().toLowerCase();
        const type = this.typeFilter();
        return this.books().filter((b) => {
            if (type && b.bookTypeCode !== type) return false;
            if (!kw) return true;
            return (
                b.name.toLowerCase().includes(kw) ||
                (b.shortName && b.shortName.toLowerCase().includes(kw)) ||
                (b.parentName && b.parentName.toLowerCase().includes(kw)) ||
                b.bookTypeName.toLowerCase().includes(kw)
            );
        });
    });

    // Danh sách sổ cha hợp lệ (không bao gồm chính sổ đang sửa)
    parentOptions(): DocumentBookResponse[] {
        const currentId = this.editingId();
        const excluded = currentId ? this.descendantIds(currentId) : new Set<number>();
        return this.books().filter(
            (b) =>
                b.id !== currentId &&
                !excluded.has(b.id) &&
                this.formBookTypeId !== null &&
                b.bookTypeId === Number(this.formBookTypeId)
        );
    }

    private descendantIds(rootId: number): Set<number> {
        const result = new Set<number>();
        const queue = [rootId];
        while (queue.length > 0) {
            const current = queue.shift()!;
            for (const b of this.books()) {
                if (b.parentId === current && !result.has(b.id)) {
                    result.add(b.id);
                    queue.push(b.id);
                }
            }
        }
        return result;
    }

    onTypeChange() {
        this.formParentId = null;
    }
    constructor(private bookService: DocumentBookService) { }

    ngOnInit() {
        this.bookService.findTypes().subscribe({
            next: (types) => this.bookTypes.set(types),
            error: (err) => this.pageError.set(err.error?.message ?? 'Không thể tải danh sách loại sổ'),
        });
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
        const filtered = this.bookTypes().find((t) => t.code === this.typeFilter());
        this.formBookTypeId = filtered ? filtered.id : null;
        this.formParentId = null;
        this.modalError.set('');
        this.showModal.set(true);
        setTimeout(() => document.getElementById('bookName')?.focus());
    }

    openEditModal(book: DocumentBookResponse) {
        this.editingId.set(book.id);
        this.formName = book.name;
        this.formShortName = book.shortName ?? '';
        this.formBookTypeId = book.bookTypeId;
        this.formParentId = book.parentId;
        this.modalError.set('');
        this.showModal.set(true);
        setTimeout(() => document.getElementById('bookName')?.focus());
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

        if (!this.formBookTypeId) {
            this.modalError.set('Vui lòng chọn loại sổ');
            return;
        }

        const payload: DocumentBookRequest = {
            name: trimmedName,
            shortName: this.formShortName.trim() ? this.formShortName.trim() : null,
            bookTypeId: Number(this.formBookTypeId),
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