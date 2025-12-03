// Bot worker - runs independently for a single session
// Spawned by the dashboard server

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

// Worker state (simplified - full state managed by dashboard)
let isRunning = true;
let isPaused = false;
const processedMessages = new Set<string>();

// Stats reported to parent process
const stats = {
  messagesReceived: 0,
  messagesSent: 0,
  startedAt: new Date().toISOString(),
  lastActivity: null as string | null,
};

// Report status to parent process
function reportStatus(status: string, data?: Record<string, unknown>): void {
  const message = JSON.stringify({
    type: 'status',
    sessionId,
    status,
    stats,
    ...data,
  });
  // Write to stdout for parent process to read
  console.log(`[WORKER] ${message}`);
}

// Handle messages from parent
process.on('message', (msg: { type: string }) => {
  if (msg.type === 'pause') {
    isPaused = true;
    reportStatus('paused');
  } else if (msg.type === 'resume') {
    isPaused = false;
    reportStatus('running');
  } else if (msg.type === 'stop') {
    isRunning = false;
    reportStatus('stopping');
  }
});

async function handleConversation(
  instance: BrowserInstance,
  conversation: Conversation
): Promise<void> {
  const { page } = instance;

  logger.info('New message detected', { sessionId, from: conversation.name });
  stats.messagesReceived++;
  stats.lastActivity = new Date().toISOString();
  reportStatus('processing', { conversation: conversation.name });

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
        stats.lastActivity = new Date().toISOString();
        logger.info('Response sent');
        reportStatus('running');
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

      if (pollCount % 5 === 0 || unread.length > 0) {
        logger.info('Poll status', { poll: pollCount, total: conversations.length, unread: unread.length });
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
    }

    await sleepRandom(config.pollIntervalMin, config.pollIntervalMax);
  }
}

async function main(): Promise<void> {
  logger.info('Worker starting', { sessionId, sessionPath });
  reportStatus('starting');

  // Initialize AI
  initAI();

  // Launch browser with session
  const browser = await launchBrowser(false);
  
  // Load session manually since we have a custom path
  const context = browser.context;
  
  // Navigate to Snapchat
  const navigated = await navigateToSnapchat(browser.page);
  if (!navigated) {
    logger.error('Failed to navigate to Snapchat');
    reportStatus('error', { message: 'Failed to navigate' });
    await closeBrowser(browser);
    process.exit(1);
  }

  // Save updated session
  await saveSession(context);

  reportStatus('running');
  logger.info('Worker running');

  // Handle shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('Worker shutting down');
    isRunning = false;
    reportStatus('stopped');
    await saveSession(context);
    await closeBrowser(browser);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start polling
  await pollLoop(browser);

  await shutdown();
}

main().catch((error) => {
  logger.error('Worker fatal error', error);
  reportStatus('error', { message: error.message });
  process.exit(1);
});

