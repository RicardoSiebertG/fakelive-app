import { Injectable } from '@angular/core';

declare let gtag: Function;

export interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  /**
   * Track a custom event
   */
  trackEvent(event: AnalyticsEvent): void {
    if (typeof gtag !== 'undefined') {
      gtag('event', event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value
      });
    }
  }

  /**
   * Track when a user starts a live stream
   */
  trackLiveStreamStart(platform: string, viewerCount: number, isVerified: boolean): void {
    this.trackEvent({
      action: 'live_stream_start',
      category: 'engagement',
      label: platform,
      value: viewerCount
    });

    // Send additional parameters
    if (typeof gtag !== 'undefined') {
      gtag('event', 'live_stream_start', {
        platform: platform,
        viewer_count: viewerCount,
        is_verified: isVerified
      });
    }
  }

  /**
   * Track when a user ends a live stream
   */
  trackLiveStreamEnd(platform: string, duration: number): void {
    this.trackEvent({
      action: 'live_stream_end',
      category: 'engagement',
      label: platform,
      value: Math.round(duration / 1000) // Convert to seconds
    });

    if (typeof gtag !== 'undefined') {
      gtag('event', 'live_stream_end', {
        platform: platform,
        duration_seconds: Math.round(duration / 1000)
      });
    }
  }

  /**
   * Track platform selection on home page
   */
  trackPlatformSelected(platform: string): void {
    this.trackEvent({
      action: 'platform_selected',
      category: 'navigation',
      label: platform
    });
  }

  /**
   * Track when setup is completed
   */
  trackSetupCompleted(platform: string, username: string, viewerCount: number, isVerified: boolean): void {
    this.trackEvent({
      action: 'setup_completed',
      category: 'conversion',
      label: platform,
      value: viewerCount
    });

    if (typeof gtag !== 'undefined') {
      gtag('event', 'setup_completed', {
        platform: platform,
        viewer_count: viewerCount,
        is_verified: isVerified,
        has_custom_username: username.length > 0
      });
    }
  }

  /**
   * Track comment interactions
   */
  trackCommentInteraction(platform: string): void {
    this.trackEvent({
      action: 'comment_viewed',
      category: 'engagement',
      label: platform
    });
  }

  /**
   * Track reactions/hearts sent
   */
  trackReactionSent(platform: string, reactionType: string): void {
    this.trackEvent({
      action: 'reaction_sent',
      category: 'engagement',
      label: `${platform}_${reactionType}`
    });
  }

  /**
   * Track viewer count changes
   */
  trackViewerMilestone(platform: string, milestone: number): void {
    this.trackEvent({
      action: 'viewer_milestone',
      category: 'engagement',
      label: platform,
      value: milestone
    });
  }

  /**
   * Track page views (automatic with gtag config, but can be used for SPA navigation)
   */
  trackPageView(path: string, title: string): void {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'page_view', {
        page_path: path,
        page_title: title
      });
    }
  }

  /**
   * Track errors
   */
  trackError(errorMessage: string, platform?: string): void {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'exception', {
        description: errorMessage,
        fatal: false,
        platform: platform
      });
    }
  }
}
