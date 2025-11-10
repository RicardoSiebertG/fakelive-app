import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { LiveConfigService } from '../services/live-config.service';
import { AnalyticsService } from '../services/analytics.service';
import { CommentService } from '../services/comment.service';

interface Comment {
  id: string;
  profileId: number;
  profilePicture: string;
  username: string;
  text: string;
  timestamp: number;
}

interface Heart {
  id: string;
  emoji: string;
  left: number;
  animationDuration: number;
  animationDelay: number;
}

interface Profile {
  id: number;
  username: string;
  name: string;
}

@Component({
  selector: 'app-tiktok-live',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tiktok-live.html',
  styleUrls: ['./tiktok-live.css'],
  animations: [
    trigger('commentAnimation', [
      transition(':enter', [
        style({ transform: 'translateY(30px)', opacity: 0, scale: 0.95 }),
        animate('500ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'translateY(0)', opacity: 1, scale: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ transform: 'translateY(-20px)', opacity: 0 }))
      ])
    ])
  ]
})
export class TikTokLive implements OnInit, OnDestroy {
  username: string = 'username';
  profilePicture: string = '';
  isVerified: boolean = false;
  viewerCount: number = 15000;
  displayViewerCount: string = '15.0K';
  comments: Comment[] = [];
  hearts: Heart[] = [];
  currentStream: MediaStream | null = null;
  facingMode: 'user' | 'environment' = 'user';
  audioEnabled: boolean = false;
  showEndConfirmation: boolean = false;
  showEndSummary: boolean = false;
  showRecordingReminder: boolean = false;
  highestViewerCount: number = 15000;
  commentedProfileIds: Set<number> = new Set();

  private viewerCountInterval: any;
  private commentInterval: any;
  private heartInterval: any;
  private commentCleanupInterval: any;
  private heartCleanupInterval: any;

  private profiles: Profile[] = [
    { id: 1, username: 'dancequeen', name: 'Dance Queen' },
    { id: 2, username: 'vibemaster', name: 'Vibe Master' },
    { id: 3, username: 'tiktoklover', name: 'TikTok Lover' },
    { id: 4, username: 'coolkid101', name: 'Cool Kid' },
    { id: 5, username: 'musicfan', name: 'Music Fan' },
    { id: 6, username: 'funnyperson', name: 'Funny Person' },
    { id: 7, username: 'creativesoul', name: 'Creative Soul' },
    { id: 8, username: 'happyvibes', name: 'Happy Vibes' },
    { id: 9, username: 'stargazer', name: 'Star Gazer' },
    { id: 10, username: 'dreamchaser', name: 'Dream Chaser' },
    { id: 11, username: 'artlover', name: 'Art Lover' },
    { id: 12, username: 'photoking', name: 'Photo King' },
    { id: 13, username: 'travelbug', name: 'Travel Bug' },
    { id: 14, username: 'foodie4life', name: 'Foodie' },
    { id: 15, username: 'gymrat', name: 'Gym Rat' },
    { id: 16, username: 'bookworm', name: 'Book Worm' },
    { id: 17, username: 'petlover', name: 'Pet Lover' },
    { id: 18, username: 'gamerboy', name: 'Gamer Boy' },
    { id: 19, username: 'fashionista', name: 'Fashionista' },
    { id: 20, username: 'techgeek', name: 'Tech Geek' },
    { id: 21, username: 'naturelover', name: 'Nature Lover' },
    { id: 22, username: 'beachbum', name: 'Beach Bum' },
    { id: 23, username: 'mountainman', name: 'Mountain Man' },
    { id: 24, username: 'citygirl', name: 'City Girl' },
    { id: 25, username: 'countrykid', name: 'Country Kid' },
    { id: 26, username: 'nightowl', name: 'Night Owl' },
    { id: 27, username: 'earlybird', name: 'Early Bird' },
    { id: 28, username: 'lazysunday', name: 'Lazy Sunday' },
    { id: 29, username: 'partytime', name: 'Party Time' },
    { id: 30, username: 'chillmode', name: 'Chill Mode' },
    { id: 31, username: 'adventurer', name: 'Adventurer' },
    { id: 32, username: 'wanderer', name: 'Wanderer' },
    { id: 33, username: 'explorer', name: 'Explorer' },
    { id: 34, username: 'discoverer', name: 'Discoverer' },
    { id: 35, username: 'seeker', name: 'Seeker' },
    { id: 36, username: 'finder', name: 'Finder' },
    { id: 37, username: 'creator', name: 'Creator' },
    { id: 38, username: 'builder', name: 'Builder' },
    { id: 39, username: 'maker', name: 'Maker' },
    { id: 40, username: 'designer', name: 'Designer' },
    { id: 41, username: 'artist', name: 'Artist' },
    { id: 42, username: 'painter', name: 'Painter' },
    { id: 43, username: 'sculptor', name: 'Sculptor' },
    { id: 44, username: 'writer', name: 'Writer' },
    { id: 45, username: 'poet', name: 'Poet' },
    { id: 46, username: 'singer', name: 'Singer' },
    { id: 47, username: 'dancer', name: 'Dancer' },
    { id: 48, username: 'actor', name: 'Actor' },
    { id: 49, username: 'comedian', name: 'Comedian' },
    { id: 50, username: 'entertainer', name: 'Entertainer' },
    { id: 51, username: 'performer', name: 'Performer' },
    { id: 52, username: 'showman', name: 'Showman' },
    { id: 53, username: 'rockstar', name: 'Rockstar' },
    { id: 54, username: 'popstar', name: 'Popstar' },
    { id: 55, username: 'superstar', name: 'Superstar' },
    { id: 56, username: 'legend', name: 'Legend' },
    { id: 57, username: 'icon', name: 'Icon' },
    { id: 58, username: 'hero', name: 'Hero' },
    { id: 59, username: 'champion', name: 'Champion' },
    { id: 60, username: 'winner', name: 'Winner' }
  ];

  private sampleComments: string[] = []; // Will be loaded from JSON files

  private streamStartTime = 0;

  constructor(
    private router: Router,
    private liveConfigService: LiveConfigService,
    private analytics: AnalyticsService,
    private commentService: CommentService
  ) {}

  async ngOnInit() {
    // Load configuration
    const config = await this.liveConfigService.loadConfig('tiktok');
    if (config) {
      this.username = config.username || 'username';
      this.profilePicture = config.profilePicture || '';
      this.isVerified = config.isVerified || false;
      this.viewerCount = config.initialViewerCount || 15000;
      this.highestViewerCount = this.viewerCount;
      this.updateDisplayViewerCount();

      // Load comments from selected languages
      const selectedLanguages = config.commentLanguages || ['en-US'];
      try {
        const loadedData = await this.commentService.loadComments(selectedLanguages);
        this.sampleComments = loadedData.comments;
        // Note: usernames from JSON could be used here in the future
        // For now we keep the hardcoded profiles array

        if (this.sampleComments.length === 0) {
          // Fallback to English US if no comments loaded
          const fallbackData = await this.commentService.loadComments(['en-US']);
          this.sampleComments = fallbackData.comments;
        }
      } catch (error) {
        console.error('Failed to load comments:', error);
        // Use fallback comments if loading fails
        this.sampleComments = ['Love this! 💕', 'Amazing! ✨', 'Keep going! 💪'];
      }
    }

    // Check if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);

    // Request camera access
    try {
      this.currentStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      const videoElement = document.getElementById('cameraFeed') as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = this.currentStream;
        videoElement.muted = true; // Ensure no audio feedback
      }

      // Enter fullscreen on mobile
      if (isMobile) {
        setTimeout(() => {
          this.enterFullscreen();
        }, 500);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please grant camera permissions and try again.');
      this.router.navigate(['/tiktok-live/setup']);
      return;
    }

    // Start simulations
    this.startViewerCountSimulation();
    this.startCommentSimulation();
    this.startHeartSimulation();

    // Track live stream start
    this.streamStartTime = Date.now();
    this.analytics.trackLiveStreamStart('tiktok', this.viewerCount, this.isVerified);

    // Show recording reminder dialog after a short delay
    setTimeout(() => {
      this.showRecordingReminder = true;
    }, 1000);
  }

  ngOnDestroy() {
    // Track live stream end
    if (this.streamStartTime > 0) {
      const duration = Date.now() - this.streamStartTime;
      this.analytics.trackLiveStreamEnd('tiktok', duration);
    }

    // Stop camera stream
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
    }

    // Clear intervals
    if (this.viewerCountInterval) clearInterval(this.viewerCountInterval);
    if (this.commentInterval) clearInterval(this.commentInterval);
    if (this.heartInterval) clearInterval(this.heartInterval);
    if (this.commentCleanupInterval) clearInterval(this.commentCleanupInterval);
    if (this.heartCleanupInterval) clearInterval(this.heartCleanupInterval);

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }

  enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    }

    // Lock to portrait orientation on mobile
    if (screen.orientation && 'lock' in screen.orientation) {
      (screen.orientation as any).lock('portrait').catch(() => {
        // Orientation lock not supported
      });
    }
  }

  startViewerCountSimulation() {
    this.viewerCountInterval = setInterval(() => {
      // Fluctuate viewer count by ±10%
      const change = Math.floor(this.viewerCount * 0.1 * (Math.random() - 0.5) * 2);
      this.viewerCount = Math.max(0, this.viewerCount + change);

      if (this.viewerCount > this.highestViewerCount) {
        this.highestViewerCount = this.viewerCount;
      }

      this.updateDisplayViewerCount();
    }, Math.random() * 2000 + 1500);
  }

  updateDisplayViewerCount() {
    if (this.viewerCount >= 1000) {
      this.displayViewerCount = (this.viewerCount / 1000).toFixed(1) + 'K';
    } else {
      this.displayViewerCount = this.viewerCount.toString();
    }
  }

  startCommentSimulation() {
    this.commentInterval = setInterval(() => {
      const profile = this.profiles[Math.floor(Math.random() * this.profiles.length)];
      const commentText = this.sampleComments[Math.floor(Math.random() * this.sampleComments.length)];

      const comment: Comment = {
        id: Date.now().toString() + Math.random(),
        profileId: profile.id,
        profilePicture: `/assets/profiles/profile-${profile.id}.jpg`,
        username: profile.username,
        text: commentText,
        timestamp: Date.now()
      };

      this.comments.unshift(comment);
      this.commentedProfileIds.add(profile.id);

      // Keep only last 6 comments
      if (this.comments.length > 6) {
        this.comments = this.comments.slice(0, 6);
      }

      // Remove old comments after 12 seconds
      setTimeout(() => {
        this.comments = this.comments.filter(c => c.id !== comment.id);
      }, 12000);
    }, Math.random() * 1200 + 800);
  }

  startHeartSimulation() {
    this.heartInterval = setInterval(() => {
      const allEmojis = ['❤️', '😂', '🔥'];

      const heart: Heart = {
        id: Date.now().toString() + Math.random(),
        emoji: allEmojis[Math.floor(Math.random() * allEmojis.length)],
        left: Math.random() * 12 + 4,
        animationDuration: Math.random() * 0.7 + 2,
        animationDelay: Math.random() * 0.3
      };

      this.hearts.push(heart);

      // Remove heart after animation completes
      setTimeout(() => {
        this.hearts = this.hearts.filter(h => h.id !== heart.id);
      }, 3000);
    }, Math.random() * 450 + 150);
  }

  getProfileInitial(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  getProfileGradient(profileId: number): string {
    const gradients = [
      'linear-gradient(135deg, #FE2C55 0%, #69C9D0 100%)',
      'linear-gradient(135deg, #FF1744 0%, #FE2C55 100%)',
      'linear-gradient(135deg, #69C9D0 0%, #25F4EE 100%)',
      'linear-gradient(135deg, #FE2C55 0%, #25F4EE 100%)',
      'linear-gradient(135deg, #FF6B6B 0%, #FE2C55 100%)',
      'linear-gradient(135deg, #4ECDC4 0%, #69C9D0 100%)'
    ];
    return gradients[profileId % gradients.length];
  }

  async toggleMicrophone() {
    this.audioEnabled = !this.audioEnabled;
    if (this.currentStream) {
      const audioTracks = this.currentStream.getAudioTracks();
      audioTracks.forEach(track => track.enabled = this.audioEnabled);
    }
  }

  async toggleCamera() {
    if (this.currentStream) {
      const videoTracks = this.currentStream.getVideoTracks();
      videoTracks.forEach(track => track.enabled = !track.enabled);
    }
  }

  async flipCamera() {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';

    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
    }

    try {
      this.currentStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      const videoElement = document.getElementById('cameraFeed') as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = this.currentStream;
        videoElement.muted = true; // Ensure no audio feedback
      }
    } catch (error) {
      console.error('Error flipping camera:', error);
    }
  }

  showEndConfirmationDialog() {
    this.showEndConfirmation = true;
  }

  cancelEnd() {
    this.showEndConfirmation = false;
  }

  confirmEnd() {
    this.showEndConfirmation = false;
    this.showEndSummary = true;
  }

  goHome() {
    this.router.navigate(['/']);
  }

  getCommentedProfiles(): Profile[] {
    const profiles = Array.from(this.commentedProfileIds)
      .map(id => this.profiles.find(p => p.id === id))
      .filter(p => p !== undefined) as Profile[];
    return profiles.slice(0, 5);
  }

  dismissRecordingReminder() {
    this.showRecordingReminder = false;
  }
}
