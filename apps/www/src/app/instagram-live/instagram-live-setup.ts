import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LiveConfigService } from '../services/live-config.service';

@Component({
  selector: 'app-instagram-live-setup',
  imports: [CommonModule, FormsModule],
  templateUrl: './instagram-live-setup.html',
  styleUrl: './instagram-live-setup.css',
})
export class InstagramLiveSetup {
  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('video', { static: false }) video?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas', { static: false }) canvas?: ElementRef<HTMLCanvasElement>;

  username = 'your_username';
  isVerified = false;
  viewerCount = 25000;
  profilePicture: string | null = null;
  showCamera = false;
  cameraStream: MediaStream | null = null;

  constructor(
    private router: Router,
    private liveConfigService: LiveConfigService
  ) {}

  ngOnDestroy() {
    this.stopCamera();
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profilePicture = e.target?.result as string;
        this.showCamera = false;
      };
      reader.readAsDataURL(file);
    }
  }

  selectFile() {
    this.fileInput?.nativeElement.click();
  }

  async startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      this.cameraStream = stream;
      this.showCamera = true;

      setTimeout(() => {
        if (this.video) {
          this.video.nativeElement.srcObject = stream;
        }
      }, 0);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please try uploading a file instead.');
    }
  }

  capturePhoto() {
    if (!this.video || !this.canvas) return;

    const video = this.video.nativeElement;
    const canvas = this.canvas.nativeElement;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      this.profilePicture = canvas.toDataURL('image/png');
      this.stopCamera();
    }
  }

  stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    this.showCamera = false;
  }

  removePhoto() {
    this.profilePicture = null;
  }

  startLive() {
    // Validate username
    if (!this.username.trim()) {
      alert('Please enter a username');
      return;
    }

    // Validate viewer count
    if (this.viewerCount < 0) {
      alert('Viewer count must be a positive number');
      return;
    }

    // Save configuration
    this.liveConfigService.setConfig({
      username: this.username.trim(),
      profilePicture: this.profilePicture,
      isVerified: this.isVerified,
      initialViewerCount: Math.floor(this.viewerCount)
    });

    // Navigate to live simulator
    this.router.navigate(['/instagram-live']);
  }

  cancel() {
    this.router.navigate(['/']);
  }
}
