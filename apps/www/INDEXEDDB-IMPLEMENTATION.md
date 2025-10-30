# IndexedDB Implementation

## Overview

FakeLive now uses IndexedDB to persist user configurations across sessions. Each platform (Instagram, TikTok, Twitch, etc.) can have its own saved configuration.

## Data Model

### PlatformConfig Interface

```typescript
interface PlatformConfig {
  id: string;              // Platform identifier: 'instagram', 'tiktok', 'twitch', etc.
  username: string;        // User's chosen username
  profilePicture: string | null;  // Base64 encoded profile picture or null
  isVerified: boolean;     // Verified badge status
  initialViewerCount: number;     // Starting viewer count
  lastUsed: Date;         // Last time this config was used
}
```

## Database Structure

- **Database Name:** `FakeLiveDB`
- **Version:** 1
- **Object Store:** `platformConfigs`
  - **Key Path:** `id` (platform identifier)
  - **Indexes:**
    - `lastUsed` - for sorting by most recently used

## Services

### IndexedDBService

Low-level service for managing IndexedDB operations.

**Methods:**
- `savePlatformConfig(config: PlatformConfig)` - Save/update a platform configuration
- `getPlatformConfig(platformId: string)` - Retrieve a specific platform config
- `getAllPlatformConfigs()` - Get all saved platform configs
- `deletePlatformConfig(platformId: string)` - Remove a platform config
- `clearAllConfigs()` - Delete all saved configurations

### LiveConfigService

High-level service for managing live stream configurations.

**Key Methods:**
- `setCurrentPlatform(platform: string)` - Set the active platform
- `loadConfig(platformId?: string)` - Load config from IndexedDB
- `saveConfig(config: Partial<LiveConfig>, platformId?: string)` - Save config to IndexedDB
- `getDefaultConfig(platform: string)` - Get platform-specific defaults

**Platform-Specific Defaults:**
- **Instagram:** 25,000 initial viewers
- **TikTok:** 15,000 initial viewers
- **Twitch:** 500 initial viewers

## How It Works

### 1. Setup Page Load
1. User navigates to `/instagram-live/setup`
2. Component calls `loadConfig('instagram')`
3. Service retrieves saved config from IndexedDB
4. Form fields are populated with saved values
5. If no saved config exists, defaults are used

### 2. Starting a Live Stream
1. User fills out the setup form
2. Clicks "Start Live"
3. Configuration is saved to IndexedDB via `saveConfig()`
4. User is navigated to the live simulator
5. Configuration is available for next time

### 3. Live Stream Initialization
1. Live component loads
2. Component calls `loadConfig('instagram')`
3. Profile picture, username, verified status, and viewer count are loaded
4. Live stream starts with personalized settings

## Storage Details

### What Gets Stored
- ✅ Username
- ✅ Profile Picture (Base64 encoded image)
- ✅ Verified Badge Status
- ✅ Initial Viewer Count
- ✅ Last Used Timestamp

### Storage Limits
- IndexedDB has generous limits (typically 50-100MB+)
- Profile pictures stored as Base64 strings
- Each platform config is stored independently

### Privacy
- All data is stored locally in the browser
- Nothing is sent to any server
- User can clear data via browser settings or the app

## Browser Compatibility

IndexedDB is supported in all modern browsers:
- ✅ Chrome/Edge (v24+)
- ✅ Firefox (v16+)
- ✅ Safari (v10+)
- ✅ Opera (v15+)

## Future Enhancements

Potential features to add:
- [ ] Export/Import configurations
- [ ] Multiple profiles per platform
- [ ] Configuration templates
- [ ] Sync across devices (requires backend)
- [ ] Configuration history/versions
- [ ] Backup/restore functionality

## Testing

To test the implementation:

1. Open the app and configure Instagram Live
2. Start the live stream
3. End the stream and return home
4. Go back to Instagram Live setup
5. Verify your previous settings are loaded

To clear data:
- Chrome DevTools → Application → IndexedDB → FakeLiveDB → Delete Database
- Or use browser's "Clear Site Data" feature
