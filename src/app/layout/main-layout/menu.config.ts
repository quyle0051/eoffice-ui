export interface MenuItem {
    label: string;
    link: string;
}

export interface MenuGroup {
    key: string;
    label: string;
    icon: 'file' | 'task' | 'folder' | 'shield';
    roles?: string[];
    children: MenuItem[];
}

export const MENU: MenuGroup[] = [
    {
        key: 'documents',
        label: 'Quản lý văn bản',
        icon: 'file',
        children: [
            { label: 'Văn bản đến', link: '/documents/incoming' },
            { label: 'Văn bản đi', link: '/documents/outgoing' },
            { label: 'Văn bản nội bộ', link: '/documents/internal' },
            //{ label: 'Hồ sơ lưu trữ', link: '/case-files' },
        ],
    },
    {
        key: 'tasks',
        label: 'Công việc',
        icon: 'task',
        children: [
            { label: 'Việc tôi chủ trì', link: '/tasks/assigned' },
            { label: 'Việc tôi hỗ trợ', link: '/tasks/supported' },
            { label: 'Việc cần theo dõi', link: '/tasks/supervised' },
            { label: 'Việc tôi giao', link: '/tasks/created' },
            { label: 'Nhóm công việc', link: '/task-groups' },
        ],
    },
    {
        key: 'catalog',
        label: 'Danh mục',
        icon: 'folder',
        roles: ['ADMIN', 'CLERK'],
        children: [
            { label: 'Sổ văn bản', link: '/document-books' },
            { label: 'Loại văn bản', link: '/document-types' },
            { label: 'Cơ quan, tổ chức', link: '/organs' },
        ],
    },
    {
        key: 'admin',
        label: 'Quản trị hệ thống',
        icon: 'shield',
        roles: ['ADMIN'],
        children: [
            { label: 'Người dùng', link: '/admin/users' },
            { label: 'Phòng ban', link: '/admin/departments' },
            { label: 'Phân quyền', link: '/admin/roles' },
            { label: 'Nhật ký hoạt động', link: '/admin/activity-logs' },
        ],
    },
];

export const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    DIRECTOR: 'Lãnh đạo',
    OFFICE_CHIEF: 'Chánh văn phòng',
    HEAD: 'Trưởng phòng',
    DEPUTY: 'Phó phòng',
    CLERK: 'Văn thư',
    STAFF: 'Chuyên viên',
};
