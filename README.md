# automate-sc

Snapchat Web automation with AI chatbot and production-grade dashboard.

## Features

- AI-powered auto-reply using DeepSeek
- Real-time dashboard with analytics
- Schedule management (active hours, weekend skip)
- Frequency controls (response delays, rate limiting)
- Personality customization (live prompt editing)
- Session management

## Structure

```
src/
  api/          Express API server
  ai/           DeepSeek AI client and prompts
  config/       Configuration
  core/         Browser and Snapchat DOM interactions
  utils/        Logging and timing utilities
  state.ts      Shared state with analytics
  index.ts      Main entry point
  login.ts      Session saver

dashboard/      React + Tailwind + Recharts dashboard
```

## Setup

```bash
# Install backend dependencies
npm install

# Install dashboard dependencies
cd dashboard && npm install && cd ..

# Install Playwright browser
npx playwright install chromium
```

Create `.env`:
```
DEEPSEEK_API_KEY=your-key-here
```

## Usage

### Save login session
```bash
npm run login
```

### Run the bot with dashboard
```bash
npm run dev
```

Dashboard available at **http://localhost:3847**

### Development (separate terminals)
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Dashboard with hot reload
npm run dev:dashboard
```

## Dashboard

### Command Center
- Start/Pause/Stop controls
- Real-time status indicator
- Session uptime and last activity

### Configuration
- Schedule: Set active hours, skip weekends
- Frequency: Response delays, max replies per hour

### Personality Matrix
- Edit AI system prompt in real-time

### Analytics
- Traffic volume chart (hourly sent/received)
- Response time distribution
- KPIs: Reply rate, avg conversation length, sentiment

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/state` | GET | Get current bot state |
| `/api/start` | POST | Start bot |
| `/api/stop` | POST | Stop bot |
| `/api/pause` | POST | Pause bot |
| `/api/resume` | POST | Resume bot |
| `/api/schedule` | POST | Update schedule |
| `/api/frequency` | POST | Update frequency |
| `/api/personality` | POST | Update AI prompt |

## License

ISC

