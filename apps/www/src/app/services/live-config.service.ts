import { Injectable } from '@angular/core';

export interface LiveConfig {
  username: string;
  profilePicture: string | null;
  isVerified: boolean;
  initialViewerCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class LiveConfigService {
  private config: LiveConfig = {
    username: 'your_username',
    profilePicture: null,
    isVerified: false,
    initialViewerCount: 25000
  };

  setConfig(config: Partial<LiveConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LiveConfig {
    return { ...this.config };
  }

  reset() {
    this.config = {
      username: 'your_username',
      profilePicture: null,
      isVerified: false,
      initialViewerCount: 25000
    };
  }
}
