import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, UserInfo } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  user = signal<UserInfo | null>(null);

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit() {
    // hỏi backend "tôi đang đăng nhập là ai?" - chưa đăng nhập thì về trang login
    this.authService.me().subscribe({
      next: (u) => this.user.set(u),
      error: () => this.router.navigate(['/login']),
    });
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}