import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private animationFrameId: number | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;

  isRecording = false;

  constructor() {}

  async startRecording(
    videoElement: HTMLVideoElement,
    overlayElements: HTMLElement[],
    watermarkText: string = 'fakelive.app'
  ): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    // Create offscreen canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = videoElement.videoWidth || 1280;
    this.canvas.height = videoElement.videoHeight || 720;
    this.ctx = this.canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('Could not get canvas context');
    }

    // Function to draw a single frame
    const drawFrame = () => {
      if (!this.ctx || !this.canvas) return;

      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Draw video
      this.ctx.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height);

      // Draw overlays
      overlayElements.forEach(element => {
        this.drawDOMElement(element);
      });

      // Draw watermark (centered, semi-transparent)
      this.drawWatermark(watermarkText);

      if (this.isRecording) {
        this.animationFrameId = requestAnimationFrame(drawFrame);
      }
    };

    // Start drawing frames
    drawFrame();

    // Capture canvas stream
    this.stream = this.canvas.captureStream(30); // 30 FPS

    // Set up MediaRecorder
    const options = {
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

    this.mediaRecorder.onstop = () => {
      this.downloadRecording();
    };

    this.mediaRecorder.start();
    this.isRecording = true;
  }

  private drawDOMElement(element: HTMLElement): void {
    if (!this.ctx || !this.canvas) return;

    const rect = element.getBoundingClientRect();
    const canvasRect = (document.getElementById('cameraFeed') as HTMLVideoElement)?.getBoundingClientRect();

    if (!canvasRect) return;

    // Calculate scale factors
    const scaleX = this.canvas.width / canvasRect.width;
    const scaleY = this.canvas.height / canvasRect.height;

    // Calculate position relative to video
    const x = (rect.left - canvasRect.left) * scaleX;
    const y = (rect.top - canvasRect.top) * scaleY;
    const width = rect.width * scaleX;
    const height = rect.height * scaleY;

    // Get computed styles
    const styles = window.getComputedStyle(element);
    const fontSize = parseFloat(styles.fontSize) * scaleX;
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;
    const textContent = element.textContent?.trim() || '';

    // Draw background if exists
    if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
      this.ctx.fillStyle = backgroundColor;
      this.ctx.fillRect(x, y, width, height);
    }

    // Draw text
    if (textContent) {
      this.ctx.fillStyle = color;
      this.ctx.font = `${fontSize}px ${styles.fontFamily}`;
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(textContent, x + 4, y + 4);
    }
  }

  private drawWatermark(text: string): void {
    if (!this.ctx || !this.canvas) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Set watermark style
    this.ctx.save();
    this.ctx.globalAlpha = 0.3; // Semi-transparent
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.font = 'bold 48px Arial, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Draw text with stroke (outline) for better visibility
    this.ctx.strokeText(text, centerX, centerY);
    this.ctx.fillText(text, centerX, centerY);

    this.ctx.restore();
  }

  stopRecording(): void {
    if (!this.isRecording) {
      console.warn('Not recording');
      return;
    }

    this.isRecording = false;

    // Stop animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop canvas stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  private downloadRecording(): void {
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
