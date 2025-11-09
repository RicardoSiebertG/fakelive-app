import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private containerElement: HTMLElement | null = null;

  isRecording = false;
  private isMobile = false;

  constructor() {
    // Detect if mobile
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  async startRecording(containerSelector: string): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    // Check if getDisplayMedia is available and not on mobile
    const hasDisplayMedia = !this.isMobile &&
                           navigator.mediaDevices &&
                           'getDisplayMedia' in navigator.mediaDevices;

    if (hasDisplayMedia) {
      await this.startScreenCapture();
    } else {
      await this.startCanvasCapture(containerSelector);
    }
  }

  private async startScreenCapture(): Promise<void> {
    try {
      // Request screen/tab capture
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser', // Prefer browser tab
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false // Don't capture system audio
      });

      await this.setupMediaRecorder();

      console.log('Screen recording started');
    } catch (error) {
      console.error('Failed to start screen recording:', error);
      throw error;
    }
  }

  private async startCanvasCapture(containerSelector: string): Promise<void> {
    try {
      this.containerElement = document.querySelector(containerSelector);
      if (!this.containerElement) {
        throw new Error(`Container element not found: ${containerSelector}`);
      }

      // Create canvas matching container size
      this.canvas = document.createElement('canvas');
      const rect = this.containerElement.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      this.ctx = this.canvas.getContext('2d');

      if (!this.ctx) {
        throw new Error('Could not get canvas context');
      }

      this.isRecording = true;

      // Start drawing frames
      this.drawFrame();

      // Get stream from canvas
      this.stream = this.canvas.captureStream(30); // 30 FPS

      await this.setupMediaRecorder();

      console.log('Canvas recording started');
    } catch (error) {
      console.error('Failed to start canvas recording:', error);
      throw error;
    }
  }

  private async setupMediaRecorder(): Promise<void> {
    if (!this.stream) {
      throw new Error('No stream available');
    }

    // Set up MediaRecorder
    const options: MediaRecorderOptions = {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    };

    // Fallback to vp8 if vp9 is not supported
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8';
    }

    this.mediaRecorder = new MediaRecorder(this.stream, options);
    this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    // Handle user stopping the recording via browser UI (screen capture only)
    if (this.stream.getVideoTracks()[0]) {
      this.stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (this.isRecording) {
          this.stopRecording();
        }
      });
    }

    // Start recording with 1 second timeslice to get data chunks regularly
    this.mediaRecorder.start(1000);
    this.isRecording = true;
  }

  private drawFrame(): void {
    if (!this.ctx || !this.canvas || !this.containerElement || !this.isRecording) {
      return;
    }

    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Find all visible elements and draw them
    this.drawElementAndChildren(this.containerElement);

    // Continue loop
    if (this.isRecording) {
      this.animationFrameId = requestAnimationFrame(() => this.drawFrame());
    }
  }

  private drawElementAndChildren(element: HTMLElement): void {
    if (!this.ctx || !this.canvas || !this.containerElement) return;

    const containerRect = this.containerElement.getBoundingClientRect();
    const rect = element.getBoundingClientRect();

    // Skip if element is outside container
    if (rect.bottom < containerRect.top || rect.top > containerRect.bottom ||
        rect.right < containerRect.left || rect.left > containerRect.right) {
      return;
    }

    // Calculate position relative to container
    const x = rect.left - containerRect.left;
    const y = rect.top - containerRect.top;
    const width = rect.width;
    const height = rect.height;

    const styles = window.getComputedStyle(element);

    // Skip hidden elements
    if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
      return;
    }

    this.ctx.save();

    // Draw video elements
    if (element instanceof HTMLVideoElement && !element.paused) {
      try {
        this.ctx.drawImage(element, x, y, width, height);
      } catch (e) {
        // Video not ready, skip
      }
    }
    // Draw images
    else if (element instanceof HTMLImageElement && element.complete) {
      try {
        this.ctx.drawImage(element, x, y, width, height);
      } catch (e) {
        // Image not ready, skip
      }
    }
    // Draw background and text for other elements
    else {
      const bgColor = styles.backgroundColor;
      const borderRadius = parseFloat(styles.borderRadius) || 0;

      // Draw background
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
        this.ctx.fillStyle = bgColor;
        if (borderRadius > 0) {
          this.ctx.beginPath();
          this.ctx.roundRect(x, y, width, height, borderRadius);
          this.ctx.fill();
        } else {
          this.ctx.fillRect(x, y, width, height);
        }
      }

      // Draw text content
      const textContent = element.textContent?.trim();
      if (textContent && element.children.length === 0) {
        const fontSize = parseFloat(styles.fontSize);
        const color = styles.color;
        const fontFamily = styles.fontFamily;

        this.ctx.fillStyle = color;
        this.ctx.font = `${fontSize}px ${fontFamily}`;
        this.ctx.textBaseline = 'top';

        const padding = 8;
        this.ctx.fillText(textContent, x + padding, y + padding, width - padding * 2);
      }
    }

    this.ctx.restore();

    // Recursively draw children
    Array.from(element.children).forEach(child => {
      if (child instanceof HTMLElement) {
        this.drawElementAndChildren(child);
      }
    });
  }

  stopRecording(): void {
    if (!this.isRecording) {
      console.warn('Not recording');
      return;
    }

    this.isRecording = false;

    // Stop animation frame (canvas recording only)
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop MediaRecorder (but don't download yet)
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop display media stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Clean up canvas references
    this.canvas = null;
    this.ctx = null;
    this.containerElement = null;

    console.log('Recording stopped - ready to save');
  }

  downloadRecording(): void {
    if (this.recordedChunks.length === 0) {
      console.warn('No recording data to download');
      return;
    }

    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fakelive-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Clear recorded chunks
    this.recordedChunks = [];
  }
}
