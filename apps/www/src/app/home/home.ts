import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  fakeLives = [
    {
      name: 'Instagram Live',
      description: 'Simulate Instagram live streaming',
      route: '/instagram-live/setup',
      icon: '📸',
      gradient: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
    }
    // Future platforms can be added here:
    // { name: 'TikTok Live', route: '/tiktok-live/setup', icon: '🎵' },
    // { name: 'Twitch Live', route: '/twitch-live/setup', icon: '🎮' },
  ];
}
