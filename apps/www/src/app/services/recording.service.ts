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
    overlayElements: HTMLElement[]
  ): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    // Create offscreen canvas matching the displayed size
    this.canvas = document.createElement('canvas');
    const displayRect = videoElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Use display size for 1:1 pixel matching with what's shown on screen
    this.canvas.width = displayRect.width * dpr;
    this.canvas.height = displayRect.height * dpr;
    this.ctx = this.canvas.getContext('2d');

    // Scale the context to account for device pixel ratio
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }

    if (!this.ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set recording flag before starting the loop
    this.isRecording = true;

    // Function to draw a single frame
    const drawFrame = () => {
      if (!this.ctx || !this.canvas) return;

      // Get CSS pixel dimensions (canvas is scaled by DPR)
      const cssWidth = displayRect.width;
      const cssHeight = displayRect.height;

      // Clear canvas (using CSS pixel coordinates since context is scaled)
      this.ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Draw video (using CSS pixel coordinates)
      this.ctx.drawImage(videoElement, 0, 0, cssWidth, cssHeight);

      // Draw overlays
      overlayElements.forEach(element => {
        this.drawDOMElement(element, videoElement);
      });

      if (this.isRecording) {
        this.animationFrameId = requestAnimationFrame(drawFrame);
      }
    };

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

    // Start recording with 1 second timeslice to get data chunks regularly
    this.mediaRecorder.start(1000);

    // Start drawing frames AFTER everything is set up
    drawFrame();
  }

  private drawDOMElement(element: HTMLElement, videoElement: HTMLVideoElement): void {
    if (!this.ctx || !this.canvas) return;

    const rect = element.getBoundingClientRect();
    const videoRect = videoElement.getBoundingClientRect();

    // Calculate position relative to video (in CSS pixels since context is scaled)
    const x = rect.left - videoRect.left;
    const y = rect.top - videoRect.top;
    const width = rect.width;
    const height = rect.height;

    // Get computed styles
    const styles = window.getComputedStyle(element);
    const fontSize = parseFloat(styles.fontSize);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;
    const borderRadius = styles.borderRadius;
    const textContent = element.textContent?.trim() || '';

    this.ctx.save();

    // Draw background with border radius if exists
    if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
      const radius = parseFloat(borderRadius) || 0;

      this.ctx.fillStyle = backgroundColor;

      if (radius > 0) {
        // Draw rounded rectangle
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, radius);
        this.ctx.fill();
      } else {
        this.ctx.fillRect(x, y, width, height);
      }
    }

    // Draw text
    if (textContent) {
      this.ctx.fillStyle = color;
      this.ctx.font = `${fontSize}px ${styles.fontFamily}`;
      this.ctx.textBaseline = 'top';

      // Add some padding for text
      const padding = 8;
      this.ctx.fillText(textContent, x + padding, y + padding);
    }

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
