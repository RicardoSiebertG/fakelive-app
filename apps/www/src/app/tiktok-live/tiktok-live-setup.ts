import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LiveConfigService } from '../services/live-config.service';

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

  constructor(
    private router: Router,
    private liveConfigService: LiveConfigService
  ) {}

  async ngOnInit() {
    // Set platform and load saved configuration
    this.liveConfigService.setCurrentPlatform('tiktok');

    try {
      const savedConfig = await this.liveConfigService.loadConfig('tiktok');

      // Populate form with saved values
      this.username = savedConfig.username;
      this.isVerified = savedConfig.isVerified;
      this.viewerCount = savedConfig.initialViewerCount;
      this.profilePicture = savedConfig.profilePicture;
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

    // Save configuration to IndexedDB
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

    // Navigate to live simulator
    this.router.navigate(['/tiktok-live']);
  }

  cancel() {
    this.router.navigate(['/']);
  }
}
