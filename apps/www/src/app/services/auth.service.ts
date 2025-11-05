import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

export interface Session {
  user: User;
  expiresAt: Date;
}

export interface PremiumStatus {
  isPremium: boolean;
  tier: 'monthly' | 'yearly' | null;
  expiresAt: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentSessionSubject = new BehaviorSubject<Session | null>(null);
  private premiumStatusSubject = new BehaviorSubject<PremiumStatus | null>(null);

  public currentSession$: Observable<Session | null> = this.currentSessionSubject.asObservable();
  public premiumStatus$: Observable<PremiumStatus | null> = this.premiumStatusSubject.asObservable();

  constructor() {
    // Load session on initialization
    this.loadSession();
  }

  /**
   * Load current session from API
   */
  private async loadSession(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/api/auth/session`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          this.currentSessionSubject.next({
            user: data.session.user,
            expiresAt: new Date(data.session.expiresAt),
          });

          // Load premium status if user is authenticated
          await this.loadPremiumStatus();
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }

  /**
   * Load premium status from API
   */
  private async loadPremiumStatus(): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      // TODO: Add API endpoint to get premium status
      // For now, we'll set it to null
      // const response = await fetch(`${this.apiUrl}/api/premium/status`, {
      //   credentials: 'include',
      // });
      // if (response.ok) {
      //   const data = await response.json();
      //   this.premiumStatusSubject.next(data);
      // }
    } catch (error) {
      console.error('Failed to load premium status:', error);
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, name?: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Sign up failed');
    }

    const data = await response.json();
    if (data.session) {
      this.currentSessionSubject.next({
        user: data.session.user,
        expiresAt: new Date(data.session.expiresAt),
      });
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Sign in failed');
    }

    const data = await response.json();
    if (data.session) {
      this.currentSessionSubject.next({
        user: data.session.user,
        expiresAt: new Date(data.session.expiresAt),
      });
      await this.loadPremiumStatus();
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<void> {
    // Redirect to Google OAuth flow
    window.location.href = `${this.apiUrl}/api/auth/sign-in/social?provider=google&redirect_uri=${window.location.origin}`;
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Password reset failed');
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Sign out failed');
    }

    this.currentSessionSubject.next(null);
    this.premiumStatusSubject.next(null);
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentSessionSubject.value?.user || null;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.getCurrentUser()?.id || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentSessionSubject.value !== null;
  }

  /**
   * Check if email is verified
   */
  isEmailVerified(): boolean {
    return this.getCurrentUser()?.emailVerified || false;
  }

  /**
   * Check if user has premium
   */
  isPremium(): boolean {
    const premium = this.premiumStatusSubject.value;
    if (!premium || !premium.isPremium || !premium.expiresAt) {
      return false;
    }
    return new Date(premium.expiresAt) > new Date();
  }

  /**
   * Check if user has full features (verified email OR premium)
   */
  hasFullFeatures(): boolean {
    return this.isEmailVerified() || this.isPremium();
  }

  /**
   * Get error message
   */
  getErrorMessage(error: any): string {
    if (error.message) {
      return error.message;
    }
    return 'An error occurred. Please try again.';
  }

  /**
   * Validate live stream start (server-side enforcement)
   */
  async validateLiveStreamStart(
    platform: 'instagram' | 'tiktok' | 'facebook',
    viewerCount: number,
    isVerified: boolean
  ): Promise<{
    success: boolean;
    hasFullFeatures: boolean;
    maxViewerCount: number;
    canUseVerified: boolean;
  }> {
    const response = await fetch(`${this.apiUrl}/api/live-streams/validate-start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ platform, viewerCount, isVerified }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Validation failed');
    }

    return await response.json();
  }
}
