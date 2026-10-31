import { Component, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { MENU, ROLE_LABELS } from './menu.config';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout implements OnInit {
  collapsed = signal(window.innerWidth < 900);

  openGroup = signal('');

  user = computed(() => this.authService.user());

  menu = computed(() => MENU.filter((g) => this.authService.hasAnyRole(g.roles)));

  initial = computed(() => (this.user()?.email ?? '?').charAt(0).toUpperCase());

  roleLabel = computed(() =>
    (this.user()?.roles ?? [])
      .map((r) => r.replace('ROLE_', ''))
      .map((r) => ROLE_LABELS[r] ?? r)
      .join(', ')
  );

  constructor(private authService: AuthService, private router: Router) {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.openGroupOfCurrentUrl();
        if (window.innerWidth < 900) {
          this.collapsed.set(true);
        }
      });
  }

  ngOnInit() {
    this.openGroupOfCurrentUrl();
    if (!this.authService.user()) {
      this.authService.me().subscribe({
        error: () => this.router.navigate(['/login']),
      });
    }
  }

  toggleSidebar() {
    this.collapsed.set(!this.collapsed());
  }

  toggleGroup(key: string) {
    this.openGroup.set(this.openGroup() === key ? '' : key);
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }

  private openGroupOfCurrentUrl() {
    const url = this.router.url;
    const group = MENU.find((g) => g.children.some((c) => url.startsWith(c.link)));
    if (group) {
      this.openGroup.set(group.key);
    }
  }
}
