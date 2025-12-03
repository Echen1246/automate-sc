# automate-sc

Snapchat Web automation with AI chatbot and command center dashboard.

## Architecture

```
Dashboard (localhost:3847)
    |
    +-- Session 1 --> Bot Worker (Playwright browser)
    |
    +-- Session 2 --> Bot Worker (Playwright browser)
    |
    +-- New Login --> Opens browser for login
```

The dashboard is the main entry point. From it you can:
- Add new Snapchat accounts (opens browser for login)
- Start/pause/stop bots for each session
- Monitor message stats in real-time

## Quick Start

```bash
# Install dependencies
npm install
cd dashboard && npm install && cd ..

# Build dashboard
npm run build:dashboard

# Install browser
npx playwright install chromium

# Create .env with your DeepSeek API key
echo "DEEPSEEK_API_KEY=your-key" > .env

# Start the dashboard
npm run dashboard
```

Open **http://localhost:3847**

## Workflow

1. Open dashboard at localhost:3847
2. Click **+** to add a new session
3. Enter account name, browser opens for login
4. Log in to Snapchat, click "Save Session"
5. Session appears in sidebar
6. Click session, then **Start Bot**
7. Bot runs in background, monitoring for messages

## Project Structure

```
src/
  server.ts       # Dashboard server (main entry)
  worker.ts       # Bot worker (spawned per session)
  sessions.ts     # Session file management
  core/
    browser.ts    # Playwright browser control
    snapchat.ts   # Snapchat DOM interactions
  ai/
    client.ts     # DeepSeek AI client
    prompts.ts    # System prompts
  config/         # Configuration
  utils/          # Logging, timing

dashboard/        # React + Tailwind dashboard
  src/
    App.tsx
    components/
      Sidebar.tsx
      CommandCard.tsx

data/
  sessions/       # Saved session files
    account-1.json
    account-2.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dashboard` | Start dashboard server |
| `npm run build:dashboard` | Build React dashboard |
| `npm run login` | CLI login (alternative to dashboard) |
| `npm run debug` | Start with debug logging |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List all sessions |
| `/api/sessions/:id/start` | POST | Start bot |
| `/api/sessions/:id/stop` | POST | Stop bot |
| `/api/sessions/:id/pause` | POST | Pause bot |
| `/api/login/start` | POST | Begin login flow |
| `/api/login/complete` | POST | Save session |

## License

ISC
