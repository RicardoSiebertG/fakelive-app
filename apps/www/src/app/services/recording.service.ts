import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  isRecording = false;

  constructor() {}

  async startRecording(cameraStream: MediaStream): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      // Set up MediaRecorder with the camera stream
      let mimeType = 'video/webm;codecs=vp9';

      // Fallback to vp8 if vp9 is not supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }

      const options: MediaRecorderOptions = {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      };

      this.mediaRecorder = new MediaRecorder(cameraStream, options);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Start recording with 1 second timeslice to get data chunks regularly
      this.mediaRecorder.start(1000);
      this.isRecording = true;

      console.log('Camera recording started');
    } catch (error) {
      console.error('Failed to start camera recording:', error);
      throw error;
    }
  }

  stopRecording(): void {
    if (!this.isRecording) {
      console.warn('Not recording');
      return;
    }

    this.isRecording = false;

    // Stop MediaRecorder (but don't download yet)
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

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
