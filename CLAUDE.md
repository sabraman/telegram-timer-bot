# Telegram Timer Bot - Architecture and Development Guide

## Project Overview

This is a **Telegram Mini App** built with **Next.js** that integrates with the **Telegram Bot API** using **GrammyJS**. It features a **client-side timer generator** that creates animated countdown stickers with transparency support, demonstrating modern web development patterns for Telegram integration.

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 (App Router) with React 19
- **Backend**: Next.js API routes + Convex for real-time database
- **UI Components**: Shadcn UI with Tailwind CSS
- **Telegram Integration**: Telegram Mini App SDK + GrammyJS
- **Authentication**: Telegram Init Data validation
- **Database**: Convex (migrated from Prisma)
- **Package Manager**: pnpm
- **Code Quality**: Biome (linting/formatting)
- **Type Safety**: TypeScript with strict configuration

### Key Directories

#### Source Code Structure
```
src/
├── app/                          # Next.js App Router
│   ├── api/bot/                 # Telegram webhook endpoint
│   ├── api/send-to-telegram/    # Timer sticker upload endpoint
│   ├── demo/                    # Demo page with Convex integration
│   ├── settings/               # Settings page components
│   ├── page.tsx                # Main timer generator page
│   └── actions.ts              # Server actions (authentication)
├── components/                  # React components
│   ├── common/                 # Shared components (auth, theme, etc.)
│   ├── timer/                  # Timer generator components
│   │   ├── ClientTimerGenerator.tsx  # Main client-side timer generator
│   │   └── TimerGenerator.tsx        # Server-side timer generator (legacy)
│   └── ui/                     # Shadcn UI components (Button, Input, Card, Progress)
├── hooks/                      # Custom React hooks (Telegram integrations)
├── lib/                        # Utility libraries
│   ├── bot/                    # Telegram bot logic
│   ├── security.ts             # Authentication utilities
│   └── env.ts                  # Environment variable validation
├── remotion/                   # Remotion video components (legacy)
│   └── TimerVideo.tsx          # Timer video composition
└── styles/                     # Global CSS
```

#### Backend Services
```
convex/                        # Convex database and functions
├── schema.ts                   # Database schema (posts table)
├── posts.ts                   # Convex functions for posts
└── _generated/                # Auto-generated types and API
```

## Building and Running

### Prerequisites
- Node.js 20+ 
- pnpm package manager
- Telegram Bot Token from @BotFather
- Convex account for database

### Setup Instructions

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Configure Environment Variables**
   Copy `.env.example` to `.env` and populate:
   ```env
   # Telegram Bot
   TG_API_TOKEN="00000:your-tg-bot-token-here"
   NEXT_PUBLIC_TG_APP_URL="https://t.me/{bot_name}/{mini_app_name}"
   NEXT_PUBLIC_SITE_URL="https://{public_app_url}"
   
   # Convex
   CONVEX_DEPLOYMENT="dev:{your-deployment-name}"
   NEXT_PUBLIC_CONVEX_URL="https://{your-deployment-name}.convex.cloud"
   ```

3. **Set Up Development Environment**
   - For local development, use ngrok or Cloudflare Tunnel to expose your local server
   - Configure BotFather with your public URL
   - Set up the mini app in Telegram Bot settings

4. **Run Development Servers**
   ```bash
   # Start Convex dev server
   pnpm convex:dev
   
   # Start Next.js dev server
   pnpm dev
   ```

### Bot Development Modes

The bot supports two operational modes:

#### 1. Webhook Mode (Production)
```bash
# Set up webhook
pnpm bot:set-webhook

# The webhook endpoint: /api/bot
```

#### 2. Polling Mode (Development)
```bash
# Run bot in polling mode
pnpm bot:poll
```

## Bot Architecture

### GrammyJS Integration
- **Main Bot File**: `src/lib/bot/bot.ts`
- **Webhook Handler**: `src/app/api/bot/route.ts`
- **Bot Scripts**: `src/scripts/bot/`

### Bot Commands
Currently implemented:
- `/start` - Welcome message
- Text message handling - Echo responses

### Security & Authentication
- **Init Data Validation**: Using `@telegram-apps/init-data-node`
- **Cookie Storage**: Telegram init data stored in cookies
- **API Token Validation**: Required for all authentication checks
- **Error Handling**: Comprehensive validation of signature, hash, and expiration

## Timer Functionality

### Implemented Features
The project includes a fully functional **client-side timer generator** that creates animated countdown stickers:

#### Core Timer Features
- **Customizable Duration**: User can input any timer duration from 1-60 seconds
- **Client-Side Generation**: Uses MediaRecorder API for browser-based video creation
- **Transparent Background**: Full alpha channel support for proper sticker appearance
- **Real-Time Progress**: Live progress bar and percentage display during generation
- **Telegram Integration**: Direct upload as animated sticker using `sendSticker` API

#### Technical Implementation
- **Canvas API**: Renders timer frames with 512x512 resolution and white text
- **MediaRecorder API**: Captures canvas as WebM video with VP9 codec
- **Frame Rate**: Optimized at 1fps (numbers change once per second)
- **File Format**: WebM with transparency support, optimized for Telegram's 50MB limit
- **UI Components**: Progress bar, loading states, and video preview

#### User Experience
1. User inputs desired timer duration (seconds)
2. Clicks "Generate Timer Sticker" button
3. Button shows real-time progress: "Generating... X%" and becomes disabled
4. Clean progress bar displays generation status
5. Video preview appears upon completion
6. "Send to Telegram" button uploads sticker directly to user's chat

### File Structure
```
src/components/timer/
├── ClientTimerGenerator.tsx     # Main client-side timer generator (ACTIVE)
├── TimerGenerator.tsx          # Server-side generator (legacy)
└── TimerVideo.tsx              # Remotion video composition (legacy)

src/app/api/
└── send-to-telegram/
    └── route.ts                # Telegram sticker upload endpoint
```

### API Integration
- **Endpoint**: `/api/send-to-telegram`
- **Method**: POST with base64 video data
- **Telegram API**: Uses `sendSticker` with `InputFile` pattern
- **File Handling**: Converts base64 to Buffer for GrammyJS upload

## Database Schema

### Current Convex Schema
```typescript
posts: defineTable({
  name: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_name", ["name"])
```

### Timer Schema (Future)
Recommended additions:
```typescript
timers: defineTable({
  userId: v.string(),
  name: v.string(),
  duration: v.number(), // in seconds
  startTime: v.number(),
  endTime: v.number(),
  status: v.enum("active", "completed", "cancelled"),
  createdAt: v.number(),
}).index("by_user", ["userId"])
```

## Development Workflow

### Scripts
```bash
# Development
pnpm dev              # Start Next.js with Turbopack
pnpm dev:ssl          # Start with HTTPS for local testing
pnpm convex:dev       # Start Convex dev server

# Bot Management
pnpm bot:poll         # Run bot in polling mode
pnpm bot:set-webhook  # Set up webhook URL

# Code Quality
pnpm lint             # Run Biome linter
pnpm lint:fix         # Auto-fix linting issues
pnpm format           # Format code
pnpm check            # Type and syntax checking
```

### Code Quality Tools
- **Biome**: Linter and formatter (replaces ESLint + Prettier)
- **TypeScript**: Strict mode with path aliases
- **Tailwind CSS**: Custom theme with Telegram integration

## Telegram Integration Patterns

### Mini App SDK Features
- **useMainButton**: Custom bottom action button
- **useBackButton**: Native back button integration
- **Viewport**: Responsive sizing for Telegram interface
- **Theme Integration**: Dynamic theme support

### Authentication Flow
1. User opens mini app via Telegram
2. Telegram provides init data (user info + signature)
3. Server validates init data using bot token
4. Authentication state stored in cookies
5. User data available throughout the app

## Deployment

### Build Commands
```bash
# Production build
pnpm build

# Deploy Convex and build
pnpm convex:deploy
```

### Environment Requirements
- `NEXT_PUBLIC_SITE_URL`: Must be publicly accessible
- `TG_API_TOKEN`: Valid bot token
- `CONVEX_DEPLOYMENT`: Convex deployment ID
- `NEXT_PUBLIC_CONVEX_URL`: Convex cloud URL

## Contributing Guidelines

### Code Style
- Use Biome formatting (double quotes, 2-space indent)
- Follow TypeScript strict mode rules
- Use path aliases (`~/*`) instead of relative imports
- Implement proper error handling for all async operations

### Bot Development
- Add new commands in `src/lib/bot/bot.ts`
- Implement webhook-friendly handlers
- Use proper validation for user input
- Log errors and handle edge cases

### Database Changes
- Update schema in `convex/schema.ts`
- Add corresponding Convex functions
- Test with both query and mutation operations

## Security Considerations

1. **Never commit secrets**: Environment variables should be in `.env.local`
2. **Validate all init data**: Use proper signature checking
3. **Sanitize user input**: Implement validation for all bot commands
4. **Use HTTPS**: Always in production
5. **Rate limiting**: Consider adding rate limiting for bot API calls

## Development Tips

- Use the demo page (`/demo`) for testing Convex integration
- Monitor Telegram Mini App SDK documentation for new features
- Test both webhook and polling modes
- Use Convex dashboard for real-time database monitoring
- Enable debug mode in `ClientRoot` for development insights

## Timer Development Notes

### Browser Compatibility
- **MediaRecorder API**: Required for client-side video generation
- **Canvas API**: Used for frame rendering with transparency
- **WebM Support**: Modern browsers support VP9 with alpha channel
- **File Size**: Monitor generated file sizes to stay under Telegram's 50MB limit

### Common Issues
- **Progress Not Showing**: Ensure `setIsGenerating(false)` is called in `mediaRecorder.onstop`, not in `finally`
- **Transparency**: Use `ctx.clearRect()` for proper alpha channel, don't fill with background color
- **Telegram Upload**: Use `InputFile` pattern with Buffer, not base64 string directly
- **Frame Rate**: 1fps is optimal for countdown timers (numbers change once per second)

### Testing
- Test timer generation in target browsers (Chrome, Firefox, Safari)
- Verify sticker uploads work in Telegram desktop and mobile apps
- Check file sizes for different timer durations
- Test edge cases (1 second, 60 second timers)

### Performance
- Canvas operations are synchronous, progress updates happen during frame generation
- MediaRecorder processes asynchronously, completion handled in `onstop` callback
- Large timers (60+ seconds) may take longer to generate due to more frames
