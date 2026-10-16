import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email = '';
  password = '';
  errorMessage = signal('');
  loading = signal(false);

  constructor(private authService: AuthService, private router: Router) { }

  onSubmit() {
    this.errorMessage.set('');
    this.loading.set(true);

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 0) {
          this.errorMessage.set('Không kết nối được tới máy chủ');
        } else {
          this.errorMessage.set(err.error?.message ?? 'Đăng nhập thất bại');
        }
      },
    });
  }
}