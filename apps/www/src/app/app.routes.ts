import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { InstagramLiveComponent } from './instagram-live/instagram-live';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'instagram-live', component: InstagramLiveComponent },
  { path: '**', redirectTo: '' }
];
