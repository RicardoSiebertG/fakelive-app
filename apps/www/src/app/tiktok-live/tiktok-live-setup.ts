import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LiveConfigService } from '../services/live-config.service';
import { AnalyticsService } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';
import { App } from '../app';

@Component({
  selector: 'app-tiktok-live-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tiktok-live-setup.html',
  styleUrls: ['./tiktok-live-setup.css']
})
export class TikTokLiveSetup implements OnInit {
  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;

  username = 'your_username';
  isVerified = false;
  viewerCount = 15000;
  profilePicture: string | null = null;
  loading = true;

  // Feature restrictions
  get hasFullFeatures(): boolean {
    return this.authService.hasFullFeatures();
  }

  get maxViewerCount(): number {
    return this.hasFullFeatures ? 999999 : 500;
  }

  get canUseVerified(): boolean {
    return this.hasFullFeatures;
  }

  constructor(
    private router: Router,
    private liveConfigService: LiveConfigService,
    private analytics: AnalyticsService,
    private authService: AuthService,
    private appComponent: App
  ) {}

  async ngOnInit() {
    // Set platform and load saved configuration from IndexedDB
    this.liveConfigService.setCurrentPlatform('tiktok');

    try {
      const savedConfig = await this.liveConfigService.loadConfig('tiktok');

      // Populate form with saved values from local storage
      this.username = savedConfig.username;
      this.isVerified = savedConfig.isVerified;
      this.viewerCount = savedConfig.initialViewerCount;
      this.profilePicture = savedConfig.profilePicture;

      // Enforce restrictions for users without full features
      if (!this.hasFullFeatures) {
        this.isVerified = false;
        if (this.viewerCount > this.maxViewerCount) {
          this.viewerCount = this.maxViewerCount;
        }
      }
    } catch (error) {
      console.error('Failed to load saved configuration', error);
    } finally {
      this.loading = false;
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profilePicture = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  selectFile() {
    this.fileInput?.nativeElement.click();
  }

  removePhoto() {
    this.profilePicture = null;
  }

  onUsernameInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    // Apply TikTok username rules:
    // 1. Remove any characters that aren't letters, numbers, periods, or underscores
    value = value.replace(/[^a-zA-Z0-9._]/g, '');

    // 2. Remove consecutive periods
    value = value.replace(/\.{2,}/g, '.');

    // 3. Limit to 24 characters (TikTok's limit)
    value = value.substring(0, 24);

    // Update the model and input value
    this.username = value;
    input.value = value;
  }

  validateUsername(): string | null {
    const username = this.username.trim();

    if (!username) {
      return 'Please enter a username';
    }

    if (username.length < 2) {
      return 'Username must be at least 2 characters';
    }

    if (username.startsWith('.') || username.endsWith('.')) {
      return 'Username cannot start or end with a period';
    }

    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      return 'Username can only contain letters, numbers, periods, and underscores';
    }

    if (/\.{2,}/.test(username)) {
      return 'Username cannot have consecutive periods';
    }

    return null;
  }

  async startLive() {
    // Validate username
    const usernameError = this.validateUsername();
    if (usernameError) {
      alert(usernameError);
      return;
    }

    // Validate viewer count
    if (this.viewerCount < 0) {
      alert('Viewer count must be a positive number');
      return;
    }

    // Enforce restrictions for users without full features
    if (!this.hasFullFeatures) {
      if (this.viewerCount > this.maxViewerCount) {
        alert(`Sign in FREE to increase viewer limit! Currently limited to ${this.maxViewerCount} viewers.`);
        return;
      }
      if (this.isVerified) {
        alert('Sign in FREE to enable verified badge!');
        return;
      }
    }

    // Enforce maximum viewer count for all users
    if (this.viewerCount > this.maxViewerCount) {
      alert(`Maximum viewer count is ${this.maxViewerCount.toLocaleString()}`);
      return;
    }

    // Save configuration to IndexedDB (local storage only)
    await this.liveConfigService.saveConfig({
      username: this.username.trim(),
      profilePicture: this.profilePicture,
      isVerified: this.isVerified,
      initialViewerCount: Math.floor(this.viewerCount)
    }, 'tiktok');

    // Also set it in memory for immediate use
    this.liveConfigService.setConfig({
      username: this.username.trim(),
      profilePicture: this.profilePicture,
      isVerified: this.isVerified,
      initialViewerCount: Math.floor(this.viewerCount)
    });

    // Validate live stream start with backend (server-side enforcement)
    if (this.authService.isAuthenticated()) {
      try {
        await this.authService.validateLiveStreamStart(
          'tiktok',
          Math.floor(this.viewerCount),
          this.isVerified
        );
      } catch (error) {
        console.error('Server validation failed:', error);
        alert(this.authService.getErrorMessage(error));
        return;
      }
    }

    // Track setup completion analytics
    this.analytics.trackSetupCompleted(
      'tiktok',
      this.username.trim(),
      Math.floor(this.viewerCount),
      this.isVerified
    );

    // Navigate to live simulator
    this.router.navigate(['/tiktok-live']);
  }

  cancel() {
    this.router.navigate(['/']);
  }

  openAuthDialog(): void {
    this.appComponent.openAuthDialog();
  }
}
