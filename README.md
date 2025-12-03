# automate-sc

Snapchat Web automation with AI chatbot and local dashboard.

## Structure

```
src/
  api/          Dashboard API server
  ai/           DeepSeek AI client and prompts
  config/       Configuration
  core/         Browser and Snapchat DOM interactions
  utils/        Logging and timing utilities
  state.ts      Shared state between bot and dashboard
  index.ts      Main entry point
  login.ts      Session saver
dashboard/
  index.html    Web dashboard UI
```

## Setup

```bash
npm install
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

### Run the bot
```bash
npm run dev
```

Opens browser and starts bot. Dashboard available at **http://localhost:3847**

## Dashboard Features

- **Start/Pause/Stop** - Control bot state
- **Statistics** - Messages sent/received, last activity
- **Schedule** - Set active hours (e.g., 9am-11pm)
- **Frequency** - Adjust poll intervals and response delays
- **Personality** - Edit AI system prompt in real-time

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

## Configuration

### Schedule
```json
{
  "enabled": true,
  "startHour": 9,
  "endHour": 23
}
```

### Frequency (milliseconds)
```json
{
  "pollIntervalMin": 2000,
  "pollIntervalMax": 5000,
  "responseDelayMin": 1500,
  "responseDelayMax": 4000
}
```

## AI Context

The bot sends the **last 10 messages** to DeepSeek for context. Configurable in `src/ai/prompts.ts`:

```typescript
export const MAX_CONTEXT_MESSAGES = 10;
```

## License

ISC
