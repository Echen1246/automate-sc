# automate-sc

Snapchat Web automation with AI chatbot integration.

## Structure

```
src/
  config/       Configuration
  core/         Browser and Snapchat DOM interactions
  ai/           DeepSeek AI client and prompts
  utils/        Logging and timing utilities
  index.ts      Main entry point
  login.ts      Session saver
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
npm start
```

### Debug mode
```bash
npm run debug
```

## Configuration

Edit `src/config/index.ts`:

| Option | Default | Description |
|--------|---------|-------------|
| pollIntervalMin | 2000 | Min ms between polls |
| pollIntervalMax | 5000 | Max ms between polls |
| responseDelayMin | 1500 | Min ms before responding |
| responseDelayMax | 4000 | Max ms before responding |
| autoReply | true | Enable AI responses |
| ignoreList | ['My AI', 'Team Snapchat'] | Conversations to skip |

## AI Prompt

Edit `src/ai/prompts.ts` to customize the bot's personality.

## License

ISC
