// Bot worker - runs independently for a single session
// Spawned by the dashboard server, reports stats via IPC

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { sleepRandom, randomDelay } from './utils/timing.js';
import { launchBrowser, saveSession, closeBrowser, type BrowserInstance } from './core/browser.js';
import {
  navigateToSnapchat,
  getConversations,
  filterConversations,
  openConversation,
  getMessages,
  sendMessage,
  exitConversation,
  type Conversation,
} from './core/snapchat.js';
import { initAI, isAIReady, getResponse } from './ai/client.js';
import { existsSync } from 'fs';

// Get session path from command line args
const sessionPath = process.argv[2];
const sessionId = process.argv[3] || 'unknown';

if (!sessionPath) {
  console.error('Usage: tsx src/worker.ts <session-path> <session-id>');
  process.exit(1);
}

if (!existsSync(sessionPath)) {
  console.error(`Session file not found: ${sessionPath}`);
  process.exit(1);
}

// Worker state
let isRunning = true;
let isPaused = false;
const processedMessages = new Set<string>();

// Stats
const stats = {
  messagesReceived: 0,
  messagesSent: 0,
  conversationsHandled: 0,
  responseTimes: [] as number[],
  startedAt: new Date().toISOString(),
  lastActivity: null as string | null,
};

// Report to parent via IPC (if available) or stdout
function report(type: string, data: Record<string, unknown> = {}): void {
  const message = {
    type,
    sessionId,
    timestamp: new Date().toISOString(),
    stats: {
      messagesReceived: stats.messagesReceived,
      messagesSent: stats.messagesSent,
      conversationsHandled: stats.conversationsHandled,
      avgResponseTime: stats.responseTimes.length > 0
        ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
        : 0,
      startedAt: stats.startedAt,
      lastActivity: stats.lastActivity,
    },
    ...data,
  };

  // Use IPC if available
  if (process.send) {
    process.send(message);
  } else {
    // Fallback to stdout with marker
    console.log(`__WORKER_MSG__${JSON.stringify(message)}__END__`);
  }
}

// Handle messages from parent
process.on('message', (msg: { type: string; config?: Record<string, unknown> }) => {
  if (msg.type === 'pause') {
    isPaused = true;
    report('status', { status: 'paused' });
  } else if (msg.type === 'resume') {
    isPaused = false;
    report('status', { status: 'running' });
  } else if (msg.type === 'stop') {
    isRunning = false;
    report('status', { status: 'stopping' });
  } else if (msg.type === 'config' && msg.config) {
    // Update runtime config
    Object.assign(config, msg.config);
    report('config_updated');
  }
});

async function handleConversation(
  instance: BrowserInstance,
  conversation: Conversation
): Promise<void> {
  const { page } = instance;
  const startTime = Date.now();

  stats.messagesReceived++;
  stats.lastActivity = new Date().toISOString();
  report('message_received', { from: conversation.name });

  logger.info('Processing message', { sessionId, from: conversation.name });

  const opened = await openConversation(page, conversation.name);
  if (!opened) {
    logger.warn('Failed to open conversation', { name: conversation.name });
    return;
  }

  await sleepRandom(1000, 2000);

  const messages = await getMessages(page);
  logger.info('Messages retrieved', { count: messages.length });

  if (messages.length === 0) {
    await exitConversation(page);
    return;
  }

  const receivedMessages = messages.filter((m) => !m.isSent);
  const lastReceived = receivedMessages[receivedMessages.length - 1];

  if (!lastReceived) {
    await exitConversation(page);
    return;
  }

  const messageKey = `${conversation.name}:${lastReceived.text}`;
  if (processedMessages.has(messageKey)) {
    await exitConversation(page);
    return;
  }

  if (config.autoReply && isAIReady()) {
    const delay = randomDelay(config.responseDelayMin, config.responseDelayMax);
    logger.info('Generating response', { delay: `${(delay / 1000).toFixed(1)}s` });
    await sleepRandom(delay, delay);

    const response = await getResponse(lastReceived.text, messages);

    if (response) {
      const sent = await sendMessage(page, response);
      if (sent) {
        processedMessages.add(messageKey);
        stats.messagesSent++;
        stats.conversationsHandled++;
        stats.lastActivity = new Date().toISOString();
        
        const responseTime = Date.now() - startTime;
        stats.responseTimes.push(responseTime);
        if (stats.responseTimes.length > 100) {
          stats.responseTimes.shift();
        }

        report('message_sent', { 
          to: conversation.name,
          responseTime,
        });
        logger.info('Response sent');
      }
    }
  } else {
    processedMessages.add(messageKey);
  }

  await sleepRandom(800, 1500);
  await exitConversation(page);
}

async function pollLoop(instance: BrowserInstance): Promise<void> {
  let pollCount = 0;

  while (isRunning) {
    pollCount++;

    if (isPaused) {
      await sleepRandom(1000, 2000);
      continue;
    }

    try {
      const allConversations = await getConversations(instance.page);
      const conversations = filterConversations(allConversations);
      const unread = conversations.filter((c) => c.hasUnread);

      if (pollCount % 10 === 0) {
        report('heartbeat', { 
          pollCount,
          totalConversations: conversations.length,
          unreadCount: unread.length,
        });
      }

      for (const conv of unread) {
        if (!isRunning || isPaused) break;
        await handleConversation(instance, conv);
        if (unread.length > 1) {
          await sleepRandom(2000, 4000);
        }
      }
    } catch (error) {
      logger.error('Poll error', error);
      report('error', { message: String(error) });
    }

    await sleepRandom(config.pollIntervalMin, config.pollIntervalMax);
  }
}

async function main(): Promise<void> {
  logger.info('Worker starting', { sessionId, sessionPath });
  report('status', { status: 'starting' });

  // Initialize AI
  initAI();

  // Launch browser with session
  const instance = await launchBrowser(false, sessionPath);

  // Navigate to Snapchat
  const navigated = await navigateToSnapchat(instance.page);
  if (!navigated) {
    logger.error('Failed to navigate to Snapchat');
    report('error', { message: 'Failed to navigate' });
    await closeBrowser(instance);
    process.exit(1);
  }

  // Save updated session
  await saveSession(instance.context, sessionPath);

  report('status', { status: 'running' });
  logger.info('Worker running');

  // Handle shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('Worker shutting down');
    isRunning = false;
    report('status', { status: 'stopped' });
    await saveSession(instance.context, sessionPath);
    await closeBrowser(instance);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start polling
  await pollLoop(instance);

  await shutdown();
}

main().catch((error) => {
  logger.error('Worker fatal error', error);
  report('error', { message: String(error) });
  process.exit(1);
});
