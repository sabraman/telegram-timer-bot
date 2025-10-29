# Telegram Timer Bot - Deployment Guide

## 🚀 Quick Deployment to Vercel

### Prerequisites
- Vercel account (sign up at [vercel.com](https://vercel.com))
- GitHub account (for automatic deployments)
- Telegram Bot Token from [@BotFather](https://t.me/botfather)
- Convex account (for database)

### Step 1: Prepare Environment Variables

1. **Copy the production template:**
   ```bash
   cp .env.production.template .env.production.local
   ```

2. **Fill in your production values:**
   ```env
   # Required: Get from @BotFather
   TG_API_TOKEN="00000:your-production-bot-token-here"

   # Required: Will be provided by Vercel after deployment
   NEXT_PUBLIC_SITE_URL="https://your-app-name.vercel.app"

   # Required: Format your Telegram Mini App URL
   NEXT_PUBLIC_TG_APP_URL="https://t.me/your_bot_name/mini_app_name"

   # Required: Deploy Convex first, then add these
   CONVEX_DEPLOYMENT="prod:your-convex-deployment-name"
   NEXT_PUBLIC_CONVEX_URL="https://your-deployment-name.convex.cloud"
   ```

### Step 2: Deploy Convex Database

1. **Deploy to Convex production:**
   ```bash
   pnpm convex deploy
   ```

2. **Get your Convex deployment details** from the Convex dashboard and add them to `.env.production.local`

### Step 3: Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy your application:**
   ```bash
   pnpm deploy:full
   ```

   This will:
   - Deploy Convex database schema
   - Deploy your Next.js app to Vercel production

4. **Set up environment variables in Vercel Dashboard:**
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add all the variables from your `.env.production.local` file

### Step 4: Configure Telegram Bot Webhook

1. **After Vercel deployment is complete, set the webhook:**
   ```bash
   pnpm bot:set-webhook:prod
   ```

2. **Verify bot health:**
   ```bash
   pnpm bot:health-check
   ```

## 🔧 Available Scripts

### Development
```bash
pnpm dev              # Start development server
pnpm convex:dev       # Start Convex development server
pnpm bot:poll         # Run bot in polling mode (dev)
pnpm bot:health-check # Check bot health
```

### Deployment
```bash
pnpm convex:deploy    # Deploy Convex schema
pnpm deploy:vercel    # Deploy to Vercel production
pnpm deploy:full      # Deploy both Convex and Vercel
```

### Bot Management
```bash
pnpm bot:set-webhook        # Set webhook for development
pnpm bot:set-webhook:prod   # Set webhook for production
pnpm bot:poll               # Run bot in polling mode
```

## 📊 Monitoring & Analytics

Your deployed application includes:

- **Timer Generation Analytics**: Track timer creation and usage
- **Bot Activity Monitoring**: Monitor webhook activity and interactions
- **Error Tracking**: Automatic error logging to Convex
- **Vercel Analytics**: Built-in performance monitoring

Access analytics via:
- Vercel Dashboard (Analytics tab)
- Convex Dashboard (Data tab)
- Custom analytics endpoints in your app

## 🛡️ Security Features

- ✅ Telegram init data validation
- ✅ Environment variable schema validation
- ✅ CORS configuration for production domains
- ✅ Secure header configuration
- ✅ HTTPS enforcement (Vercel automatic)

## 🚨 Troubleshooting

### Bot Webhook Issues
```bash
# Check current webhook status
pnpm bot:health-check

# Reset webhook if needed
pnpm bot:set-webhook:prod
```

### Environment Variable Issues
- Ensure all required variables are set in Vercel dashboard
- Check variable names match exactly (including NEXT_PUBLIC_ prefix)
- Verify Convex deployment URL is correct

### Build Issues
```bash
# Check build locally
pnpm build

# Verify environment validation
pnpm typecheck
```

### Performance Issues
- Check Vercel Analytics for performance metrics
- Monitor Convex database usage
- Review bundle size in Vercel build logs

## 🔄 CI/CD (Future Enhancement)

For automated deployments, consider adding GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 📱 Testing Your Deployment

1. **Open your Telegram Mini App** using the configured URL
2. **Test timer generation** and sticker upload functionality
3. **Verify bot responses** in Telegram
4. **Check analytics** in both Vercel and Convex dashboards

## 🆘 Support

If you encounter issues:

1. Check this deployment guide first
2. Review Vercel and Convex documentation
3. Check error logs in Vercel dashboard
4. Run `pnpm bot:health-check` for bot diagnostics
5. Review Convex dashboard for database issues

---

**Deployment Status**: Ready for production deployment 🎉