import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

type AuthMode = 'signin' | 'signup' | 'reset';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-dialog.html',
  styleUrl: './auth-dialog.css',
})
export class AuthDialog {
  @Output() close = new EventEmitter<void>();

  isOpen = false;
  mode: AuthMode = 'signin';
  loading = false;
  errorMessage = '';
  successMessage = '';

  // Form fields
  email = '';
  password = '';
  confirmPassword = '';
  displayName = '';

  constructor(private authService: AuthService) {}

  open(initialMode: AuthMode = 'signin'): void {
    this.isOpen = true;
    this.mode = initialMode;
    this.clearMessages();
    this.clearForm();
  }

  closeDialog(): void {
    this.isOpen = false;
    this.clearForm();
    this.clearMessages();
    this.close.emit();
  }

  switchMode(mode: AuthMode): void {
    this.mode = mode;
    this.clearMessages();
  }

  clearForm(): void {
    this.email = '';
    this.password = '';
    this.confirmPassword = '';
    this.displayName = '';
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  async handleEmailAuth(): Promise<void> {
    this.clearMessages();

    // Validation
    if (!this.email || !this.password) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    if (this.mode === 'signup' && !this.displayName) {
      this.errorMessage = 'Please enter your name.';
      return;
    }

    if (this.mode === 'signup' && this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.loading = true;

    try {
      if (this.mode === 'signup') {
        await this.authService.signUp(this.email, this.password, this.displayName);
        this.successMessage = 'Account created successfully! Please check your email to verify your account.';
        setTimeout(() => this.closeDialog(), 2000);
      } else {
        await this.authService.signIn(this.email, this.password);
        this.successMessage = 'Signed in successfully!';
        setTimeout(() => this.closeDialog(), 1500);
      }
    } catch (error: any) {
      this.errorMessage = this.authService.getErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  async handleGoogleSignIn(): Promise<void> {
    this.clearMessages();
    this.loading = true;

    try {
      await this.authService.signInWithGoogle();
      // Note: This will redirect to Google OAuth, so success message may not be shown
      this.successMessage = 'Redirecting to Google...';
    } catch (error: any) {
      this.errorMessage = this.authService.getErrorMessage(error);
      this.loading = false;
    }
  }

  async handlePasswordReset(): Promise<void> {
    this.clearMessages();

    if (!this.email) {
      this.errorMessage = 'Please enter your email address.';
      return;
    }

    this.loading = true;

    try {
      await this.authService.sendPasswordReset(this.email);
      this.successMessage = 'Password reset email sent! Check your inbox.';
      setTimeout(() => this.switchMode('signin'), 3000);
    } catch (error: any) {
      this.errorMessage = this.authService.getErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  handleBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-overlay')) {
      this.closeDialog();
    }
  }
}
