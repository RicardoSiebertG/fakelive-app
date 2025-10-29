# FakeLive Monorepo

A collection of fake live streaming simulators for various platforms.

## Structure

```
fakelive-monorepo/
├── apps/
│   └── www/          # Main Angular application
└── README.md
```

## Apps

### www

The main web application built with Angular (latest). Features:

- Modern startup-style home page for selecting fake live platforms
- Instagram Live simulator with:
  - Real-time camera feed
  - Simulated viewer count
  - Animated comments from fake users
  - Floating hearts/reactions
  - Interactive controls (mic, camera flip, effects, etc.)

## Development

### Prerequisites

- Node.js (v18 or later)
- npm

### Setup

```bash
cd apps/www
npm install
```

### Run Development Server

```bash
cd apps/www
npm start
```

Navigate to `http://localhost:4200/`

### Build

```bash
cd apps/www
npm run build
```

## Cloudflare Pages Deployment

This monorepo is configured to be deployed on Cloudflare Pages.

**Build Configuration:**
- Build command: `cd apps/www && npm install && npm run build`
- Build output directory: `apps/www/dist/www/browser`

## Future Platforms

- TikTok Live
- Twitch Live
- YouTube Live
- And more...

## License

MIT
