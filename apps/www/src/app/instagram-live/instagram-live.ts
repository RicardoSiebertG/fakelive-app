import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LiveConfigService } from '../services/live-config.service';

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
})
export class InstagramLive implements OnInit, OnDestroy {
  @ViewChild('cameraFeed', { static: false }) cameraFeed?: ElementRef<HTMLVideoElement>;

  viewerCount = 0;
  displayViewerCount = '0';
  currentStream: MediaStream | null = null;
  facingMode: 'user' | 'environment' = 'user';
  loading = true;
  audioEnabled = true;
  comments: Array<{ username: string; text: string; profileId?: number; initial: string; gradient: string }> = [];
  hearts: Array<{ id: number; emoji: string; animClass: string; right: string }> = [];

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

  sampleComments = [
    'Hi! 👋', 'Love this', 'Where are you?', 'Hey!!', 'Looking good!',
    'What are you doing?', '❤️❤️❤️', 'Say hi!', 'Nice', 'Hello',
    'Amazing', '🔥🔥', 'Cool!', 'Hi from NYC!', 'Love your content',
    '😍😍', 'This is great', 'Can you see this?', 'Shoutout please!',
    '💯', 'Wow!', 'This is awesome', 'Hey from LA!', '💕💕',
    'You look great', 'What\'s up?', 'Love it', 'So cool', 'Nice stream',
    'Hello there!', 'Greetings!', 'Awesome!', 'Beautiful', 'Perfect',
    'Great stuff', '👏👏👏', 'Keep it up', '🙌', 'Yay!', 'Good vibes'
  ];

  gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  ];

  constructor(
    private router: Router,
    private liveConfigService: LiveConfigService
  ) {}

  async ngOnInit() {
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
    } catch (error) {
      // Fallback to memory config
      const config = this.liveConfigService.getConfig();
      this.username = config.username;
      this.profilePicture = config.profilePicture;
      this.isVerified = config.isVerified;
      this.initialViewerCount = config.initialViewerCount;
      this.userInitial = config.username.charAt(0).toUpperCase();
    }

    await this.initCamera();
  }

  ngOnDestroy() {
    this.stopAllSimulations();
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
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

      this.startViewerSimulation();
      this.startCommentSimulation();
      this.startHeartSimulation();
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.loading = false;
    }
  }

  startViewerSimulation() {
    // Start with the configured initial viewer count
    this.viewerCount = this.initialViewerCount;
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

    this.comments.push({ username, text, profileId, initial, gradient });

    while (this.comments.length > 6) {
      this.comments.shift();
    }

    setTimeout(() => {
      const index = this.comments.findIndex(c => c.username === username && c.text === text);
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
    const reactions = Math.random() < 0.8 ?
      ['❤️', '💕', '💖', '💗', '💓', '💘'] :
      ['😂', '🔥', '💯'];
    const emoji = reactions[Math.floor(Math.random() * reactions.length)];
    const randomOffset = Math.random() * 12 + 4;
    const right = randomOffset + 'px';
    const id = this.heartIdCounter++;

    this.hearts.push({ id, emoji, animClass, right });

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

  endLive() {
    const confirmEnd = confirm('End Live Video?');
    if (confirmEnd) {
      this.stopAllSimulations();
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => track.stop());
      }
      this.router.navigate(['/']);
    }
  }
}
