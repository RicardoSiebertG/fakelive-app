import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {

  fakeLives = [
    {
      name: 'Instagram Live',
      description: 'Create your parallel Instagram reality with thousands of followers',
      route: '/instagram-live/setup',
      icon: 'logo-instagram',
      gradient: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
    },
    {
      name: 'TikTok Live',
      description: 'Experience parallel TikTok fame with viral live streams',
      route: '/tiktok-live/setup',
      icon: 'logo-tiktok',
      gradient: 'linear-gradient(135deg, #FE2C55 0%, #69C9D0 100%)'
    }
    // Future platforms can be added here:
    // { name: 'Twitch Live', route: '/twitch-live/setup', icon: 'logo-twitch' },
  ];
}
