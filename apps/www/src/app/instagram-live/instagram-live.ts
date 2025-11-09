import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostBinding, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LiveConfigService } from '../services/live-config.service';
import { AnalyticsService } from '../services/analytics.service';
import { CommentService } from '../services/comment.service';
import { RecordingService } from '../services/recording.service';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

interface Profile {
  id: number;
  username: string;
  name: string;
}

@Component({
  selector: 'app-instagram-live',
  imports: [CommonModule],
  templateUrl: './instagram-live.html',
  styleUrl: './instagram-live.css',
  animations: [
    trigger('commentAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px) scale(0.95)' }),
        animate('500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-out',
          style({ opacity: 0, transform: 'translateY(-20px) scale(0.95)' }))
      ])
    ]),
    trigger('listAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(30px) scale(0.95)' }),
          animate('500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
        ], { optional: true }),
        query(':leave', [
          animate('300ms ease-out',
            style({ opacity: 0, transform: 'translateY(-20px) scale(0.95)' }))
        ], { optional: true })
      ])
    ])
  ]
})
export class InstagramLive implements OnInit, OnDestroy {
  @ViewChild('cameraFeed', { static: false }) cameraFeed?: ElementRef<HTMLVideoElement>;
  @HostBinding('class.fullscreen-active') isFullscreenActive = false;

  viewerCount = 0;
  displayViewerCount = '0';
  currentStream: MediaStream | null = null;
  facingMode: 'user' | 'environment' = 'user';
  loading = true;
  audioEnabled = true;
  showEndConfirmation = false;
  showEndSummary = false;
  highestViewerCount = 0;
  summaryViewerProfiles: number[] = [];
  comments: Array<{ id: number; username: string; text: string; profileId?: number; initial: string; gradient: string }> = [];
  hearts: Array<{ id: number; emoji: string; animClass: string; right: string }> = [];
  private commentIdCounter = 0;
  private isMobile = false;
  private fullscreenElement: HTMLElement | null = null;
  private commentedProfileIds = new Set<number>();

  // User configuration
  username = 'your_username';
  profilePicture: string | null = null;
  isVerified = false;
  userInitial = 'Y';

  private viewerInterval?: ReturnType<typeof setInterval>;
  private commentInterval?: ReturnType<typeof setInterval>;
  private heartScheduler?: ReturnType<typeof setTimeout>;
  private currentCommentIndex = 0;
  private currentProfileIndex = 0;
  private heartIdCounter = 0;
  private initialViewerCount = 25000;

  profiles: Profile[] = [
    {id: 1, username: "orangemouse205", name: "Matilda Thompson"},
    {id: 2, username: "crazytiger813", name: "Denise Adams"},
    {id: 3, username: "lazypanda138", name: "Aubrey Grewal"},
    {id: 4, username: "sadfish421", name: "Allen Flores"},
    {id: 5, username: "blackfrog150", name: "Carolyn Austin"},
    {id: 6, username: "bluezebra674", name: "Bella Hughes"},
    {id: 7, username: "goldenpanda721", name: "Alex Jackson"},
    {id: 8, username: "tinygorilla461", name: "Nicole Price"},
    {id: 9, username: "heavytiger123", name: "Jar Knight"},
    {id: 10, username: "tinygorilla882", name: "Jasper Li"},
    {id: 11, username: "purpleostrich779", name: "Eric Stone"},
    {id: 12, username: "ticklishostrich196", name: "Lea Brown"},
    {id: 13, username: "sadtiger667", name: "Salvador Rivera"},
    {id: 14, username: "bigduck384", name: "Ayla Jones"},
    {id: 15, username: "bigdog750", name: "Mason Morales"},
    {id: 16, username: "happygorilla918", name: "Allison Brewer"},
    {id: 17, username: "bigleopard368", name: "Bessie Lawson"},
    {id: 18, username: "redlion976", name: "Lily Mitchell"},
    {id: 19, username: "lazymeercat416", name: "Randy Gilbert"},
    {id: 20, username: "happysnake558", name: "Billie Wilson"},
    {id: 21, username: "angrybear518", name: "Krin Knight"},
    {id: 22, username: "goldengorilla445", name: "Ivan Torres"},
    {id: 23, username: "yellowgoose551", name: "Virgil Wright"},
    {id: 24, username: "beautifulpeacock457", name: "Lucy Richards"},
    {id: 25, username: "greengoose144", name: "Wilma Bates"},
    {id: 26, username: "happyrabbit784", name: "Debbie Turner"},
    {id: 27, username: "bluerabbit278", name: "Loretta Sanchez"},
    {id: 28, username: "orangelion449", name: "Don Sanchez"},
    {id: 29, username: "tinytiger936", name: "Lily Taylor"},
    {id: 30, username: "tinygoose980", name: "Peter Garza"},
    {id: 31, username: "purpledog258", name: "Lisa Soto"},
    {id: 32, username: "brownmeercat241", name: "Morris Cooper"},
    {id: 33, username: "redpeacock947", name: "Georgia Campbell"},
    {id: 34, username: "heavyostrich924", name: "Jack French"},
    {id: 35, username: "blackelephant407", name: "Candice Peck"},
    {id: 36, username: "bigpanda158", name: "Herbert Fleming"},
    {id: 37, username: "goldengoose359", name: "Elsie Dean"},
    {id: 38, username: "happyladybug309", name: "Amber Andrews"},
    {id: 39, username: "redostrich705", name: "Stanley West"},
    {id: 40, username: "bigwolf783", name: "Angus Walker"},
    {id: 41, username: "bluemouse204", name: "Myrtle Miles"},
    {id: 42, username: "bigbird992", name: "Aubree Bouchard"},
    {id: 43, username: "purplefish302", name: "Joshua Singh"},
    {id: 44, username: "smallzebra953", name: "Isabella Thompson"},
    {id: 45, username: "redbird456", name: "Beatrice Tremblay"},
    {id: 46, username: "heavydog427", name: "Florence Thompson"},
    {id: 47, username: "brownfrog348", name: "Kaylee Thompson"},
    {id: 48, username: "blackmeercat714", name: "Emma Shelton"},
    {id: 49, username: "blackbear352", name: "Clara Gagné"},
    {id: 50, username: "orangegoose736", name: "Zara Roberts"},
    {id: 51, username: "blackduck782", name: "Dominic Clark"},
    {id: 52, username: "greengoose168", name: "John Hamilton"},
    {id: 53, username: "organiccat683", name: "Calvin Rhodes"},
    {id: 54, username: "sadcat404", name: "Leah Cole"},
    {id: 55, username: "greentiger610", name: "Zoe Grewal"},
    {id: 56, username: "ticklishduck876", name: "Nicolas Denys"},
    {id: 57, username: "greenswan958", name: "Denise Rice"},
    {id: 58, username: "blackbutterfly626", name: "Marcus Hughes"},
    {id: 59, username: "organicgorilla361", name: "Connor Lawrence"},
    {id: 60, username: "heavygoose401", name: "Rodney Peters"}
  ];

  sampleComments: string[] = []; // Will be loaded from JSON files

  gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  ];

  private streamStartTime = 0;

  constructor(
    private router: Router,
    private liveConfigService: LiveConfigService,
    private analytics: AnalyticsService,
    private commentService: CommentService,
    private recordingService: RecordingService
  ) {}

  async ngOnInit() {
    // Detect mobile device
    this.isMobile = this.detectMobile();

    // Set up fullscreen change listeners
    this.setupFullscreenListeners();

    // Load configuration from IndexedDB or memory
    this.liveConfigService.setCurrentPlatform('instagram');

    try {
      // Try to load from IndexedDB first
      const config = await this.liveConfigService.loadConfig('instagram');
      this.username = config.username;
      this.profilePicture = config.profilePicture;
      this.isVerified = config.isVerified;
      this.initialViewerCount = config.initialViewerCount;
      this.userInitial = config.username.charAt(0).toUpperCase();

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
        this.sampleComments = ['Hi! 👋', 'Love this', 'Amazing', '🔥🔥', 'Awesome!'];
      }
    } catch (error) {
      // Fallback to memory config
      const config = this.liveConfigService.getConfig();
      this.username = config.username;
      this.profilePicture = config.profilePicture;
      this.isVerified = config.isVerified;
      this.initialViewerCount = config.initialViewerCount;
      this.userInitial = config.username.charAt(0).toUpperCase();

      // Load comments from selected languages
      const selectedLanguages = config.commentLanguages || ['en-US'];
      try {
        const loadedData = await this.commentService.loadComments(selectedLanguages);
        this.sampleComments = loadedData.comments;
        if (this.sampleComments.length === 0) {
          const fallbackData = await this.commentService.loadComments(['en-US']);
          this.sampleComments = fallbackData.comments;
        }
      } catch (error) {
        console.error('Failed to load comments:', error);
        this.sampleComments = ['Hi! 👋', 'Love this', 'Amazing', '🔥🔥', 'Awesome!'];
      }
    }

    await this.initCamera();
  }

  setupFullscreenListeners() {
    const fullscreenChangeHandler = () => {
      this.isFullscreenActive = !!document.fullscreenElement;
    };

    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);
  }

  detectMobile(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;

    return isMobileUA || (isTouchDevice && isSmallScreen);
  }

  ngOnDestroy() {
    this.stopAllSimulations();
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
    }
    // Exit fullscreen if active
    if (this.isMobile && document.fullscreenElement) {
      this.exitFullscreen();
    }
  }

  async initCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.currentStream = stream;
      if (this.cameraFeed) {
        this.cameraFeed.nativeElement.srcObject = stream;
      }
      this.loading = false;

      // Enter fullscreen on mobile devices
      if (this.isMobile) {
        setTimeout(() => {
          this.enterFullscreen();
        }, 100);
      }

      this.startViewerSimulation();
      this.startCommentSimulation();
      this.startHeartSimulation();

      // Track live stream start
      this.streamStartTime = Date.now();
      this.analytics.trackLiveStreamStart('instagram', this.initialViewerCount, this.isVerified);

      // Start recording automatically
      setTimeout(() => {
        this.startRecording();
      }, 500);
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.loading = false;
    }
  }

  startViewerSimulation() {
    // Start with the configured initial viewer count
    this.viewerCount = this.initialViewerCount;
    this.highestViewerCount = this.initialViewerCount;
    this.updateViewerCount();

    // Calculate the fluctuation range (±10% of initial count)
    const fluctuationRange = Math.floor(this.initialViewerCount * 0.1);
    const minViewers = this.initialViewerCount - fluctuationRange;
    const maxViewers = this.initialViewerCount + fluctuationRange;

    this.viewerInterval = setInterval(() => {
      // Random change within the ±10% range
      const maxChange = Math.floor(fluctuationRange * 0.02); // Small incremental changes
      const change = Math.random() > 0.5 ?
        Math.floor(Math.random() * maxChange) + 1 :
        -Math.floor(Math.random() * maxChange);

      // Apply change but keep within the ±10% bounds
      this.viewerCount = Math.max(minViewers, Math.min(maxViewers, this.viewerCount + change));
      this.updateViewerCount();
    }, 1500 + Math.random() * 2000);
  }

  updateViewerCount() {
    // Track highest viewer count
    if (this.viewerCount > this.highestViewerCount) {
      this.highestViewerCount = this.viewerCount;
    }

    if (this.viewerCount >= 1000) {
      const thousands = Math.floor(this.viewerCount / 100) / 10;
      this.displayViewerCount = thousands.toFixed(1) + 'K';
    } else {
      this.displayViewerCount = this.viewerCount.toString();
    }
  }

  startCommentSimulation() {
    this.commentInterval = setInterval(() => {
      if (this.profiles.length > 0) {
        const profile = this.profiles[this.currentProfileIndex];
        this.currentProfileIndex = (this.currentProfileIndex + 1) % this.profiles.length;

        const comment = this.sampleComments[this.currentCommentIndex];
        this.currentCommentIndex = (this.currentCommentIndex + 1) % this.sampleComments.length;

        this.addComment(profile.username, comment, profile.id);
      }
    }, 800 + Math.random() * 1200);
  }

  addComment(username: string, text: string, profileId?: number) {
    const initial = username.charAt(0).toUpperCase();
    const gradient = this.gradients[Math.floor(Math.random() * this.gradients.length)];
    const id = this.commentIdCounter++;

    // Track profile IDs from comments for end summary
    if (profileId) {
      this.commentedProfileIds.add(profileId);
    }

    // Add new comment at the beginning (will appear at bottom with column-reverse)
    this.comments.unshift({ id, username, text, profileId, initial, gradient });

    // Remove oldest comments (from the end of array, which is top visually)
    while (this.comments.length > 6) {
      this.comments.pop();
    }

    // Remove this specific comment after timeout
    setTimeout(() => {
      const index = this.comments.findIndex(c => c.id === id);
      if (index !== -1) {
        this.comments.splice(index, 1);
      }
    }, 12000);
  }

  startHeartSimulation() {
    const scheduleNextHeart = () => {
      const delay = 150 + Math.random() * 450;
      this.heartScheduler = setTimeout(() => {
        if (Math.random() > 0.15) {
          this.createHeart();
        }
        scheduleNextHeart();
      }, delay);
    };
    scheduleNextHeart();
  }

  createHeart() {
    const animClass = 'anim' + (Math.floor(Math.random() * 3) + 1);
    const reactions = ['❤️', '😂', '🔥'];
    const emoji = reactions[Math.floor(Math.random() * reactions.length)];
    const randomOffset = Math.random() * 12 + 4;
    const right = randomOffset + 'px';
    const id = this.heartIdCounter++;

    this.hearts.push({ id, emoji, animClass, right });

    // Track reaction analytics (sample every 20th to avoid too many events)
    if (this.heartIdCounter % 20 === 0) {
      const reactionType = emoji === '❤️' ? 'heart' : emoji === '😂' ? 'laugh' : 'fire';
      this.analytics.trackReactionSent('instagram', reactionType);
    }

    setTimeout(() => {
      const index = this.hearts.findIndex(h => h.id === id);
      if (index !== -1) {
        this.hearts.splice(index, 1);
      }
    }, 3000);
  }

  stopAllSimulations() {
    if (this.viewerInterval) clearInterval(this.viewerInterval);
    if (this.commentInterval) clearInterval(this.commentInterval);
    if (this.heartScheduler) clearTimeout(this.heartScheduler);
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    console.log('Audio ' + (this.audioEnabled ? 'enabled' : 'muted'));
  }

  toggleCamera() {
    console.log('Toggle camera on/off');
  }

  async flipCamera() {
    if (!this.currentStream) return;

    this.currentStream.getTracks().forEach(track => track.stop());
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.currentStream = stream;
      if (this.cameraFeed) {
        this.cameraFeed.nativeElement.srcObject = stream;
      }
    } catch (error) {
      console.error('Error flipping camera:', error);
      this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    }
  }

  toggleEffects() {
    console.log('Effects panel');
  }

  addGuest() {
    console.log('Add guest to live');
  }

  inviteUser() {
    console.log('Invite user to live');
  }

  showQuestions() {
    console.log('Show questions panel');
  }

  shareStream() {
    console.log('Share live stream');
  }

  onCommentInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value.trim()) {
      this.addComment(this.username, input.value);
      input.value = '';
    }
  }

  async enterFullscreen() {
    try {
      const element = document.documentElement;
      this.fullscreenElement = element;

      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        // Safari
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        // Firefox
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        // IE/Edge
        await (element as any).msRequestFullscreen();
      }

      // Update fullscreen state
      this.isFullscreenActive = true;

      // Lock orientation to portrait on mobile
      if ('screen' in window && 'orientation' in (window.screen as any)) {
        try {
          const screenOrientation = (window.screen as any).orientation;
          if (screenOrientation && screenOrientation.lock) {
            await screenOrientation.lock('portrait');
          }
        } catch (error) {
          // Orientation lock may fail, ignore
          console.log('Orientation lock not supported or failed');
        }
      }
    } catch (error) {
      console.error('Error entering fullscreen:', error);
    }
  }

  async exitFullscreen() {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }

      // Update fullscreen state
      this.isFullscreenActive = false;

      // Unlock orientation
      if ('screen' in window && 'orientation' in (window.screen as any)) {
        try {
          const screenOrientation = (window.screen as any).orientation;
          if (screenOrientation && screenOrientation.unlock) {
            screenOrientation.unlock();
          }
        } catch (error) {
          // Ignore unlock errors
        }
      }

      this.fullscreenElement = null;
    } catch (error) {
      console.error('Error exiting fullscreen:', error);
    }
  }

  endLive() {
    this.showEndConfirmation = true;
  }

  cancelEndLive() {
    this.showEndConfirmation = false;
  }

  async confirmEndLive() {
    // Stop recording and download video
    this.stopRecording();

    this.showEndConfirmation = false;
    this.stopAllSimulations();
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
    }

    // Track live stream end
    const duration = Date.now() - this.streamStartTime;
    this.analytics.trackLiveStreamEnd('instagram', duration);

    // Generate profile list from commenters (up to 5)
    this.summaryViewerProfiles = Array.from(this.commentedProfileIds).slice(0, 5);

    // Show end summary
    this.showEndSummary = true;
  }

  async dismissEndSummary() {
    this.showEndSummary = false;

    // Exit fullscreen if active
    if (this.isMobile && document.fullscreenElement) {
      await this.exitFullscreen();
    }

    this.router.navigate(['/']);
  }

  getFormattedHighestViewerCount(): string {
    if (this.highestViewerCount >= 1000) {
      const thousands = Math.floor(this.highestViewerCount / 100) / 10;
      return thousands.toFixed(1) + 'K';
    }
    return this.highestViewerCount.toString();
  }

  private async startRecording() {
    const videoElement = document.getElementById('camera-feed') as HTMLVideoElement;
    if (!videoElement) {
      console.error('Video element not found');
      return;
    }

    // Get all overlay elements (comments section, header, etc.)
    const overlayElements: HTMLElement[] = [];
    const commentsSection = document.querySelector('.comments-section') as HTMLElement;
    if (commentsSection) {
      overlayElements.push(commentsSection);
    }

    try {
      await this.recordingService.startRecording(videoElement, overlayElements);
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }

  private stopRecording() {
    this.recordingService.stopRecording();
    console.log('Recording stopped and downloading');
  }
}
