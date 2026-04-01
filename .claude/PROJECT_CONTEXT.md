# CapitalQuest — Project Context for Claude Code

## Overview
CapitalQuest is a virtual stock trading simulator for ages 10-15. Players trade with fake money using real stock prices from Yahoo Finance.

## Tech Stack
- **Frontend**: React Native + Expo (web build hosted on GitHub Pages)
- **Backend**: Firebase (Firestore + Auth)
- **Hosting**: GitHub Pages at https://capitalquest.co
- **Stock Data**: Yahoo Finance API via Cloudflare Worker proxy
- **Emails**: Resend (weekly performance emails via GitHub Actions)
- **Repo**: https://github.com/Aussie-slenderman/Aussie-slenderman.GitHub.io

## Key Architecture

### Build & Deploy Process
After ANY code change, you MUST follow this process:
1. `npx expo export --platform web --clear` — rebuilds the app
2. Copy the new bundle: `cp dist/_expo/static/js/web/entry-*.js _expo/static/js/web/entry-cq-vXX-live.js`
3. Patch the bundle (apply these patches every time):
   - Remove 3M/6M from period selector: replace `v=['1D','1W','1M','3M','6M','1Y','5Y']` with `v=['1D','1W','1M','1Y','5Y']`
   - Remove data thinning: replace all `maxPoints:300/200/150/100/60` with `maxPoints:9999`
   - Change home button: replace `children:"Markets"` with `children:"Trade Here"` (near quickBtn)
   - Normalize trade chart data: replace `Le=(0,t.useMemo)(()=>ae.map(e=>({value:e.close})),[ae])` with normalization formula
   - Fix trade chart: add `adjustToWidth:!0,initialSpacing:0,endSpacing:0` to trade screen LineChart
4. Update ALL HTML files to reference the new bundle with cache-busting: `entry-cq-vXX-live.js?v=TIMESTAMP`
5. `git add -A && git commit && git push origin main`

### Important: There are 2 LineCharts
- **Home screen chart** (module ~1967386): `LineChart,{data:G,...}` — portfolio performance
- **Trade screen chart** (module ~2490524): `S.LineChart,{data:Le,...}` — stock price chart
Always patch the TRADE screen chart, not just the home one.

### Cloudflare Worker Proxy
- URL: `https://cq-yahoo-proxy.capitalquest.workers.dev`
- Proxies Yahoo Finance API requests to bypass CORS
- Source code in `yahoo-proxy/` directory
- Deployed via `npx wrangler deploy` from that directory

### Firebase
- Project: capitalquest-4d20b
- Auth: Email/password (emails are `randomId@capitalquest.app`)
- Firestore collections: users, portfolios, leaderboard, clubs, chatRooms, transactions, clubInvites, friendRequests, portfolioHistory
- Admin emails: `theosmales1@gmail.com` and `cq.admin.mod@capitalquest.app`
- Moderator login page: `/moderator-login.html` → `/admin-dashboard.html`

### Resend (Email)
- Domain: capitalquest.co (verified)
- Sends from: `reports@capitalquest.co`
- Weekly emails via GitHub Actions (`.github/workflows/weekly-email.yml`)
- Script: `scripts/send-weekly-emails.js`
- Uses `notificationEmail` field on user docs for real email addresses

### Registration Flow
1. Welcome → Register (username + password, Firebase Auth uses random email)
2. Avatar selection (animal)
3. Terms of Service
4. Email entry (optional, saves as `notificationEmail`)
5. Setup (starting balance)
6. Dashboard

### Key Features
- Real-time stock prices from Yahoo Finance
- Buy/sell stocks with virtual money
- Portfolio tracking with holdings, orders, gain/loss
- Leaderboard (global + local by country)
- Clubs with chat
- Friend system
- Weekly performance emails
- XP/leveling system
- Achievements
- Settings persist to Firestore

## Remaining TODO Items
1. Fix 'insufficient permissions' when inviting friends/club members
2. Remove shop background options from profile settings
3. Remove Shop, AI Advisor, Settings from sidebar menu
4. Fix club entry - players can enter club page and communicate
5. Fix club leaderboard to rank only club members
6. Add country selection during signup with search bar
7. Fix local leaderboard to filter by player's country
8. Add Capital Quest logo to welcome/signup page (user needs to save image first)

## Current Bundle Version
v73 — `entry-cq-v73-live.js`

## Owner
Theo Smales (theosmales1@gmail.com)
