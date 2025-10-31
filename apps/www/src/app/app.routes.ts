import { Routes } from '@angular/router';
import { Home } from './home/home';
import { InstagramLive } from './instagram-live/instagram-live';
import { InstagramLiveSetup } from './instagram-live/instagram-live-setup';
import { TikTokLive } from './tiktok-live/tiktok-live';
import { TikTokLiveSetup } from './tiktok-live/tiktok-live-setup';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'instagram-live/setup', component: InstagramLiveSetup },
  { path: 'instagram-live', component: InstagramLive },
  { path: 'tiktok-live/setup', component: TikTokLiveSetup },
  { path: 'tiktok-live', component: TikTokLive },
  { path: '**', redirectTo: '' }
];
