# Telegram Timer Bot - Architecture and Development Guide

## Project Overview

This is a **Telegram Mini App** built with **Next.js** that integrates with the **Telegram Bot API** using **GrammyJS**. It includes a real-time timer functionality and demonstrates modern web development patterns for Telegram integration.

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
│   ├── demo/                    # Demo page with Convex integration
│   ├── settings/               # Settings page components
│   └── actions.ts              # Server actions (authentication)
├── components/                  # React components
│   ├── common/                 # Shared components (auth, theme, etc.)
│   └── ui/                     # Shadcn UI components
├── hooks/                      # Custom React hooks (Telegram integrations)
├── lib/                        # Utility libraries
│   ├── bot/                    # Telegram bot logic
│   ├── security.ts             # Authentication utilities
│   └── env.ts                  # Environment variable validation
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

The timer functionality is not yet implemented but the architecture supports it through:

### Current Infrastructure
- **Real-time Database**: Convex for timer state storage
- **Telegram UI Components**: Custom hooks for button interactions
- **API Routes**: Backend endpoints for timer operations
- **Server Actions**: State management via server components

### Timer Implementation Plan
1. Add timer schema to `convex/schema.ts`
2. Create timer mutations/queries in Convex
3. Build timer UI components
4. Add timer commands to bot (start/stop/status)
5. Integrate with Telegram buttons and mini app interface

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
