import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, UserInfo } from '../../services/auth.service';

interface Tile {
  title: string;
  desc: string;
  link: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  user = computed(() => this.authService.user());

  today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  tiles: Tile[] = [
    { title: 'Văn bản đến', desc: 'Xem và xử lý văn bản đến', link: '/documents/incoming' },
    { title: 'Văn bản đi', desc: 'Soạn thảo, trình ký, phát hành', link: '/documents/outgoing' },
    { title: 'Văn bản nội bộ', desc: 'Văn bản trao đổi trong cơ quan', link: '/documents/internal' },
    { title: 'Việc được giao', desc: 'Công việc bạn cần thực hiện', link: '/tasks/assigned' },
    { title: 'Việc tôi giao', desc: 'Theo dõi tiến độ việc đã giao', link: '/tasks/created' },
    { title: 'Hồ sơ lưu trữ', desc: 'Tra cứu hồ sơ công việc', link: '/case-files' },
  ];

  constructor(private authService: AuthService) { }
}