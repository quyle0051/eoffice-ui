import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Home } from './pages/home/home';
import { Placeholder } from './pages/placeholder/placeholder';
import { MainLayout } from './layout/main-layout/main-layout';
import { DocumentBooks } from './pages/document-books/document-books';
import { IncomingDocuments } from './pages/incoming-documents/incoming-documents';
import { IncomingDocumentForm } from './pages/incoming-document-form/incoming-document-form';
import { IncomingDocumentDispatch } from './pages/incoming-document-dispatch/incoming-document-dispatch';
import { TaskList } from './pages/task-list/task-list';
import { TaskDetail } from './pages/task-detail/task-detail';
import { OutgoingDocuments } from './pages/outgoing-documents/outgoing-documents';
import { OutgoingDocumentForm } from './pages/outgoing-document-form/outgoing-document-form';

const todo = (path: string, title: string, group: string) => ({
    path,
    component: Placeholder,
    data: { title, group },
});

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: Login },
    {
        path: '',
        component: MainLayout,
        children: [
            { path: 'home', component: Home },
            { path: 'documents/incoming/:id/dispatch', component: IncomingDocumentDispatch },
            // Quản lý văn bản
            { path: 'documents/incoming/new', component: IncomingDocumentForm },
            { path: 'documents/incoming', component: IncomingDocuments },
            { path: 'documents/outgoing', component: OutgoingDocuments },
            { path: 'documents/outgoing/new', component: OutgoingDocumentForm },
            { path: 'documents/outgoing/:id/edit', component: OutgoingDocumentForm },
            todo('documents/internal', 'Văn bản nội bộ', 'Quản lý văn bản'),
            todo('case-files', 'Hồ sơ lưu trữ', 'Quản lý văn bản'),


            // Công việc
            todo('tasks/new', 'Giao việc', 'Công việc'),
            { path: 'tasks/assigned', component: TaskList },
            { path: 'tasks/supported', component: TaskList },
            { path: 'tasks/supervised', component: TaskList },
            { path: 'tasks/created', component: TaskList },
            { path: 'tasks/:id', component: TaskDetail },
            todo('task-groups', 'Nhóm công việc', 'Công việc'),

            // Danh mục
            { path: 'document-books', component: DocumentBooks },
            todo('document-types', 'Loại văn bản', 'Danh mục'),
            todo('organs', 'Cơ quan, tổ chức', 'Danh mục'),

            // Quản trị hệ thống
            todo('admin/users', 'Người dùng', 'Quản trị hệ thống'),
            todo('admin/departments', 'Phòng ban', 'Quản trị hệ thống'),
            todo('admin/roles', 'Phân quyền', 'Quản trị hệ thống'),
            todo('admin/activity-logs', 'Nhật ký hoạt động', 'Quản trị hệ thống'),
        ],
    },

    { path: '**', redirectTo: 'home' },
];