import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { sleepRandom, randomDelay } from './utils/timing.js';
import { launchBrowser, saveSession, closeBrowser, hasSession, type BrowserInstance } from './core/browser.js';
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

// Track processed messages to avoid duplicates
const processedMessages = new Set<string>();

async function handleConversation(
  instance: BrowserInstance,
  conversation: Conversation
): Promise<void> {
  const { page } = instance;

  logger.info('New message detected', { from: conversation.name, preview: conversation.preview });

  // Open the conversation
  const opened = await openConversation(page, conversation.name);
  if (!opened) {
    logger.warn('Failed to open conversation', { name: conversation.name });
    return;
  }

  await sleepRandom(1000, 2000);

  // Get messages
  const messages = await getMessages(page);
  logger.info('Messages retrieved', { count: messages.length });

  if (messages.length === 0) {
    logger.warn('No messages found in chat');
    await exitConversation(page);
    return;
  }

  // Find last received message
  const receivedMessages = messages.filter((m) => !m.isSent);
  const lastReceived = receivedMessages[receivedMessages.length - 1];

  if (!lastReceived) {
    logger.warn('No received messages found');
    await exitConversation(page);
    return;
  }

  logger.info('Last message from user', { text: lastReceived.text });

  // Check if already processed
  const messageKey = `${conversation.name}:${lastReceived.text}`;
  if (processedMessages.has(messageKey)) {
    logger.debug('Message already processed');
    await exitConversation(page);
    return;
  }

  // Generate and send response
  if (config.autoReply && isAIReady()) {
    const delay = randomDelay(config.responseDelayMin, config.responseDelayMax);
    logger.info('Generating response', { delay: `${(delay / 1000).toFixed(1)}s` });
    await sleepRandom(delay, delay);

    const response = await getResponse(lastReceived.text, messages);

    if (response) {
      const sent = await sendMessage(page, response);
      if (sent) {
        processedMessages.add(messageKey);
        logger.info('Response sent successfully');
      }
    } else {
      logger.warn('No response generated');
    }
  } else {
    processedMessages.add(messageKey);
    logger.info('Auto-reply disabled or AI not ready');
  }

  await sleepRandom(800, 1500);
  await exitConversation(page);
}

async function pollLoop(instance: BrowserInstance): Promise<void> {
  let pollCount = 0;

  const poll = async (): Promise<void> => {
    pollCount++;

    try {
      const allConversations = await getConversations(instance.page);
      const conversations = filterConversations(allConversations);
      const unread = conversations.filter((c) => c.hasUnread);

      if (pollCount % 5 === 0 || unread.length > 0) {
        logger.info('Poll status', {
          poll: pollCount,
          total: conversations.length,
          unread: unread.length,
        });
      }

      // Handle unread conversations
      for (const conv of unread) {
        await handleConversation(instance, conv);
        if (unread.length > 1) {
          await sleepRandom(2000, 4000);
        }
      }
    } catch (error) {
      logger.error('Poll error', error);
    }

    // Schedule next poll
    const nextDelay = randomDelay(config.pollIntervalMin, config.pollIntervalMax);
    setTimeout(poll, nextDelay);
  };

  // Start polling
  await poll();
}

async function main(): Promise<void> {
  logger.info('Starting Snapchat automation');
  logger.info('Configuration', {
    pollInterval: `${config.pollIntervalMin}-${config.pollIntervalMax}ms`,
    autoReply: config.autoReply,
    debug: config.debug,
  });

  // Check for session
  if (!(await hasSession())) {
    logger.error('No session found. Run: npm run login');
    process.exit(1);
  }

  // Initialize AI
  const aiReady = initAI();
  logger.info('AI status', { ready: aiReady });

  // Launch browser
  const instance = await launchBrowser(false);

  // Handle shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down');
    await saveSession(instance.context);
    await closeBrowser(instance);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Navigate to Snapchat
  const navigated = await navigateToSnapchat(instance.page);
  if (!navigated) {
    logger.error('Failed to navigate to Snapchat');
    await closeBrowser(instance);
    process.exit(1);
  }

  // Save session
  await saveSession(instance.context);

  // Initial scan
  const initial = await getConversations(instance.page);
  const filtered = filterConversations(initial);
  logger.info('Initial scan complete', {
    total: initial.length,
    filtered: filtered.length,
    unread: filtered.filter((c) => c.hasUnread).length,
  });

  // Start polling
  logger.info('Starting message monitoring');
  await pollLoop(instance);
}

main().catch((error) => {
  logger.error('Fatal error', error);
  process.exit(1);
});

