import { Routes } from '@angular/router';
import { Home } from './home/home';
import { InstagramLive } from './instagram-live/instagram-live';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'instagram-live', component: InstagramLive },
  { path: '**', redirectTo: '' }
];
