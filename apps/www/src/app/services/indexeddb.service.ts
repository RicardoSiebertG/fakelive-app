import { Injectable } from '@angular/core';

export interface PlatformConfig {
  id: string; // 'instagram', 'tiktok', 'twitch', etc.
  username: string;
  profilePicture: string | null;
  isVerified: boolean;
  initialViewerCount: number;
  lastUsed: Date;
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private dbName = 'FakeLiveDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for platform configurations
        if (!db.objectStoreNames.contains('platformConfigs')) {
          const objectStore = db.createObjectStore('platformConfigs', { keyPath: 'id' });

          // Create indexes
          objectStore.createIndex('lastUsed', 'lastUsed', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async savePlatformConfig(config: PlatformConfig): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['platformConfigs'], 'readwrite');
      const objectStore = transaction.objectStore('platformConfigs');

      // Update lastUsed timestamp
      const configToSave = {
        ...config,
        lastUsed: new Date()
      };

      const request = objectStore.put(configToSave);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to save platform config');
        reject(request.error);
      };
    });
  }

  async getPlatformConfig(platformId: string): Promise<PlatformConfig | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['platformConfigs'], 'readonly');
      const objectStore = transaction.objectStore('platformConfigs');
      const request = objectStore.get(platformId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Failed to get platform config');
        reject(request.error);
      };
    });
  }

  async getAllPlatformConfigs(): Promise<PlatformConfig[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['platformConfigs'], 'readonly');
      const objectStore = transaction.objectStore('platformConfigs');
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('Failed to get all platform configs');
        reject(request.error);
      };
    });
  }

  async deletePlatformConfig(platformId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['platformConfigs'], 'readwrite');
      const objectStore = transaction.objectStore('platformConfigs');
      const request = objectStore.delete(platformId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete platform config');
        reject(request.error);
      };
    });
  }

  async clearAllConfigs(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['platformConfigs'], 'readwrite');
      const objectStore = transaction.objectStore('platformConfigs');
      const request = objectStore.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear all configs');
        reject(request.error);
      };
    });
  }
}
