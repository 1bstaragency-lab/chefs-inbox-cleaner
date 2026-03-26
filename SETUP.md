# Chef's Inbox Cleaner â Setup & Deploy Guide

## 1. Google Cloud Setup (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Gmail API**:
   - APIs & Services â Library â Search "Gmail API" â Enable
4. Create OAuth credentials:
   - APIs & Services â Credentials â Create Credentials â OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs: add both:
     - `http://localhost:8888` (for local dev)
     - `https://your-site-name.netlify.app` (add after deploy)
5. Copy your **Client ID** and **Client Secret**

## 2. Local Development

```bash
# Install dependencies
npm install

# Create .env file from template
cp .env.example .env

# Fill in your credentials in .env:
# VITE_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=your-secret
# VITE_APP_URL=http://localhost:8888

# Install Netlify CLI
npm install -g netlify-cli

# Run locally (starts Vite + Netlify Functions)
netlify dev
```

Open `http://localhost:8888` and sign in with Google.

## 3. Deploy to Netlify

### Option A: Git Deploy (recommended)
```bash
# Push to GitHub
git init && git add -A && git commit -m "initial commit"
gh repo create chefs-inbox-cleaner --public --push

# Connect on Netlify
# Go to https://app.netlify.com â Add new site â Import from Git
# Select your repo â Deploy
```

### Option B: CLI Deploy
```bash
netlify deploy --prod
```

### After deploying:
1. Go to **Netlify Dashboard â Site Settings â Environment Variables**
2. Add these three variables:
   - `VITE_GOOGLE_CLIENT_ID` = your Google client ID
   - `GOOGLE_CLIENT_SECRET` = your Google client secret
   - `VITE_APP_URL` = `https://your-site-name.netlify.app`
3. Go back to Google Cloud Console â OAuth Credentials
4. Add your Netlify URL to **Authorized redirect URIs**
5. Redeploy: `netlify deploy --prod` or push a commit

## 4. Google OAuth Consent Screen

Before others can sign in, configure the consent screen:
1. Google Cloud Console â APIs & Services â OAuth consent screen
2. Set to **External** (or Internal for Workspace)
3. Add app name: "Chef's Inbox Cleaner"
4. Add your email as test user during development
5. Submit for verification when ready for public use

## File Structure

```
chefs-inbox-cleaner/
âââ index.html              # Entry HTML
âââ netlify.toml            # Netlify build + redirect config
âââ package.json            # Dependencies
âââ vite.config.js          # Vite config with proxy
âââ .env.example            # Environment variable template
âââ public/
â   âââ favicon.svg
âââ src/
â   âââ main.jsx            # React entry point
â   âââ App.jsx             # Main UI (all components)
â   âââ gmail.js            # Gmail API service layer
â   âââ useAuth.js          # Google OAuth hook
âââ netlify/
    âââ functions/
        âââ auth-callback.js  # Token exchange (server-side)
        âââ auth-refresh.js   # Token refresh (server-side)
```

## Features

- **Sign in with Gmail** â secure OAuth 2.0 with server-side token exchange
- **Smart categorization** â auto-sorts into Clients, Vendors, Orders, Invoices, Spam
- **Delete Spam** â one-click removes all detected promotional/junk mail
- **Instant Clean** â deletes spam + archives emails older than 7 days
- **Categorize All** â labels everything by business category
- **Progress bars** â live tracking of deleted, archived, categorized counts
- **Bulk actions** â select multiple emails to delete or archive at once
