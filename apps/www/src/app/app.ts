import { Component, signal, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthDialog } from './auth-dialog/auth-dialog';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AuthDialog],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  @ViewChild(AuthDialog) authDialog?: AuthDialog;
  protected readonly title = signal('www');

  constructor(public authService: AuthService) {}

  openAuthDialog(): void {
    this.authDialog?.open('signin');
  }
}
