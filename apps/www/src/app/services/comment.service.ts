import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface CommentLanguage {
  language: string;
  country?: string;
  languageCode: string;
  languageName: string;
  usernames: string[];
  comments: string[];
}

export interface AvailableLanguage {
  code: string;
  name: string;
  flag: string;
}

export interface LoadedComments {
  comments: string[];
  usernames: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private commentCache: Map<string, LoadedComments> = new Map();

  // Available languages with their flags
  readonly availableLanguages: AvailableLanguage[] = [
    { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
    { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
    { code: 'en-CA', name: 'English (Canada)', flag: '🇨🇦' },
    { code: 'es-MX', name: 'Español (México)', flag: '🇲🇽' },
    { code: 'es-AR', name: 'Español (Argentina)', flag: '🇦🇷' },
    { code: 'es-CL', name: 'Español (Chile)', flag: '🇨🇱' },
    { code: 'es-ES', name: 'Español (España)', flag: '🇪🇸' },
    { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷' },
    { code: 'fr-FR', name: 'Français (France)', flag: '🇫🇷' },
    { code: 'fr-CA', name: 'Français (Canada)', flag: '🇨🇦' },
    { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
    { code: 'ar-EG', name: 'العربية (مصر)', flag: '🇪🇬' },
    { code: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ur-PK', name: 'اردو', flag: '🇵🇰' },
    { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
    { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
    { code: 'id-ID', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'tl-PH', name: 'Filipino', flag: '🇵🇭' },
    { code: 'tr-TR', name: 'Türkçe', flag: '🇹🇷' }
  ];

  constructor(private http: HttpClient) {}

  /**
   * Load comments from multiple language files
   * @param languageCodes Array of language codes to load (e.g., ['en-US', 'es-MX'])
   * @param scenario The comment scenario folder (default: 'default')
   * @returns Object with comments and usernames mixed from the specified languages
   */
  async loadComments(languageCodes: string[], scenario: string = 'default'): Promise<LoadedComments> {
    if (!languageCodes || languageCodes.length === 0) {
      // Default to English US if no languages specified
      languageCodes = ['en-US'];
    }

    const allComments: string[] = [];
    const allUsernames: string[] = [];

    // Load each language file
    for (const langCode of languageCodes) {
      try {
        const data = await this.loadLanguageData(langCode, scenario);
        allComments.push(...data.comments);
        allUsernames.push(...data.usernames);
      } catch (error) {
        console.error(`Failed to load data for language: ${langCode}`, error);
      }
    }

    // Shuffle the combined arrays for random mixing
    return {
      comments: this.shuffleArray(allComments),
      usernames: this.shuffleArray(allUsernames)
    };
  }

  /**
   * Load data for a specific language
   * @param languageCode Language code (e.g., 'en-US', 'es-MX')
   * @param scenario The comment scenario folder (default: 'default')
   * @returns Object with comments and usernames for the language
   */
  private async loadLanguageData(languageCode: string, scenario: string = 'default'): Promise<LoadedComments> {
    // Check cache first
    const cacheKey = `${scenario}_${languageCode}`;
    if (this.commentCache.has(cacheKey)) {
      return this.commentCache.get(cacheKey)!;
    }

    // Load from JSON file
    const url = `/assets/comments/${scenario}/${languageCode}.json`;
    try {
      const data = await firstValueFrom(this.http.get<CommentLanguage>(url));
      const loadedData: LoadedComments = {
        comments: data.comments || [],
        usernames: data.usernames || []
      };

      // Cache the data
      this.commentCache.set(cacheKey, loadedData);

      return loadedData;
    } catch (error) {
      console.error(`Failed to load data from ${url}`, error);
      return { comments: [], usernames: [] };
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get available language options
   */
  getAvailableLanguages(): AvailableLanguage[] {
    return this.availableLanguages;
  }

  /**
   * Clear the comment cache
   */
  clearCache(): void {
    this.commentCache.clear();
  }
}
