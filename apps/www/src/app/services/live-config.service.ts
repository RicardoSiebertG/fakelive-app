import { Injectable } from '@angular/core';
import { IndexedDBService, PlatformConfig } from './indexeddb.service';

export interface LiveConfig {
  username: string;
  profilePicture: string | null;
  isVerified: boolean;
  initialViewerCount: number;
  commentLanguages?: string[]; // Language codes for comments (e.g., ['en', 'es'])
}

@Injectable({
  providedIn: 'root'
})
export class LiveConfigService {
  private currentPlatform: string = 'instagram';
  private config: LiveConfig = {
    username: 'your_username',
    profilePicture: null,
    isVerified: false,
    initialViewerCount: 25000,
    commentLanguages: ['en-US'] // Default to English (US)
  };

  constructor(private indexedDBService: IndexedDBService) {}

  setCurrentPlatform(platform: string) {
    this.currentPlatform = platform;
  }

  getCurrentPlatform(): string {
    return this.currentPlatform;
  }

  async loadConfig(platformId?: string): Promise<LiveConfig> {
    const platform = platformId || this.currentPlatform;

    try {
      const savedConfig = await this.indexedDBService.getPlatformConfig(platform);

      if (savedConfig) {
        this.config = {
          username: savedConfig.username,
          profilePicture: savedConfig.profilePicture,
          isVerified: savedConfig.isVerified,
          initialViewerCount: savedConfig.initialViewerCount,
          commentLanguages: savedConfig.commentLanguages || ['en']
        };
      } else {
        // Return default config for this platform
        this.config = this.getDefaultConfig(platform);
      }
    } catch (error) {
      console.error('Failed to load config from IndexedDB', error);
      this.config = this.getDefaultConfig(platform);
    }

    return { ...this.config };
  }

  async saveConfig(config: Partial<LiveConfig>, platformId?: string): Promise<void> {
    const platform = platformId || this.currentPlatform;
    this.config = { ...this.config, ...config };

    const platformConfig: PlatformConfig = {
      id: platform,
      username: this.config.username,
      profilePicture: this.config.profilePicture,
      isVerified: this.config.isVerified,
      initialViewerCount: this.config.initialViewerCount,
      commentLanguages: this.config.commentLanguages || ['en'],
      lastUsed: new Date()
    };

    try {
      await this.indexedDBService.savePlatformConfig(platformConfig);
    } catch (error) {
      console.error('Failed to save config to IndexedDB', error);
    }
  }

  setConfig(config: Partial<LiveConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LiveConfig {
    return { ...this.config };
  }

  private getDefaultConfig(platform: string): LiveConfig {
    // Platform-specific defaults
    const defaults: Record<string, LiveConfig> = {
      instagram: {
        username: 'your_username',
        profilePicture: null,
        isVerified: false,
        initialViewerCount: 25000,
        commentLanguages: ['en-US']
      },
      tiktok: {
        username: 'your_username',
        profilePicture: null,
        isVerified: false,
        initialViewerCount: 15000,
        commentLanguages: ['en-US']
      },
      twitch: {
        username: 'your_username',
        profilePicture: null,
        isVerified: false,
        initialViewerCount: 500,
        commentLanguages: ['en-US']
      }
    };

    return defaults[platform] || defaults['instagram'];
  }

  async getAllConfigs(): Promise<PlatformConfig[]> {
    try {
      return await this.indexedDBService.getAllPlatformConfigs();
    } catch (error) {
      console.error('Failed to get all configs', error);
      return [];
    }
  }

  async deleteConfig(platformId: string): Promise<void> {
    try {
      await this.indexedDBService.deletePlatformConfig(platformId);
    } catch (error) {
      console.error('Failed to delete config', error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      await this.indexedDBService.clearAllConfigs();
    } catch (error) {
      console.error('Failed to clear all configs', error);
    }
  }
}
