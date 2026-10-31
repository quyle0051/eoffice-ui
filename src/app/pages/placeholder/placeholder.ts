import { Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  imports: [RouterLink],
  templateUrl: './placeholder.html',
  styleUrl: './placeholder.css',
})
export class Placeholder {
  title = signal('');
  group = signal('');

  constructor(route: ActivatedRoute) {
    const data = route.snapshot.data;
    this.title.set(data['title'] ?? '');
    this.group.set(data['group'] ?? '');
  }
}
