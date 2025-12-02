# Snapper 🔮

A **strictly local** Snapchat Web automation tool using Playwright. Detects incoming chat messages using DOM polling (the proven approach used by successful Snapchat bots).

## Why DOM Polling?

After research, network interception doesn't work well for Snapchat because:
- ❌ Messages use encrypted Protocol Buffers (gRPC-web)
- ❌ API endpoints change frequently
- ❌ WebSocket frames are binary and unreadable

**DOM polling works** because Snapchat must display messages to users:
- ✅ Poll the UI for unread indicators
- ✅ Use MutationObserver for real-time detection
- ✅ Read actual message text from the DOM
- ✅ Works regardless of backend changes

## Setup

```bash
# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium
```

## Usage

### Step 1: Save Your Login Session

```bash
npm run save-cookies
```

This opens a browser - log into Snapchat Web, then press Enter.

### Step 2: Run the Message Monitor

```bash
npm start

# Or with debug logging
npm run debug
```

## What You'll See

```
🔮 Snapper - DOM-Based Message Detection
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Initial conversation scan:
   Found 5 conversations:
   1. ⚪ John
   2. ⚪ Sarah
   3. 🔴 UNREAD Mike
   4. ⚪ Team Chat
   5. ⚪ Mom

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👀 Monitoring for new messages...
   Polling every 3 seconds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔
NEW MESSAGE(S) DETECTED!
🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔

📬 Unread from: Mike
   Preview: "Hey, are you free tonight?"
```

## Adding a Chatbot

The script has a clearly marked hook for your chatbot logic:

```javascript
// In src/index.js, find the CHATBOT HOOK section:

// 🤖 CHATBOT HOOK - Add your logic here!
// 
// Example: Auto-open and read the message
await openConversation(conv.name);
const messages = await getCurrentMessages();
const lastMessage = messages[messages.length - 1];
console.log(`Last message: "${lastMessage?.text}"`);

// Example: Auto-reply
await sendMessage("Thanks for your message!");

// Example: Call your AI
const response = await yourChatbotAPI(lastMessage.text);
await sendMessage(response);
```

## Available Functions

| Function | Description |
|----------|-------------|
| `getConversations()` | Returns list of all conversations with unread status |
| `openConversation(name)` | Clicks on a conversation to open it |
| `getCurrentMessages()` | Gets recent messages from open chat |
| `sendMessage(text)` | Types and sends a message |

## How It Works

1. **Polling**: Every 3 seconds, scans the sidebar for conversations with unread indicators (blue dots, bold text, badges)

2. **MutationObserver**: Watches for real-time DOM changes that indicate new messages

3. **Detection**: When unread count increases, logs the conversation name and preview

4. **Interaction**: Helper functions let you open chats, read messages, and send replies

## Configuration

Edit `src/index.js`:

```javascript
const POLL_INTERVAL = 3000;  // Check every 3 seconds (increase to reduce CPU)
const DEBUG = true;          // Enable verbose logging
```

## Troubleshooting

### "No conversations found"
- Wait for page to fully load (5-10 seconds)
- Run `npm run save-cookies` to re-authenticate
- Check if you're logged in by looking at the browser window

### "Could not find message input"
- Make sure a conversation is open
- Snapchat may have changed their UI - check selector patterns

### Bot detection / Captcha
- The script uses stealth plugin to avoid detection
- Don't send messages too rapidly
- Add random delays between actions

## Disclaimer

This tool is for **educational and personal automation purposes only**. Using automated tools may violate Snapchat's Terms of Service. Use responsibly and at your own risk.

## License

ISC

## This Readme was created by AI
