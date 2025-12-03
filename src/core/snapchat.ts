import type { Page } from 'playwright';
import { logger } from '../utils/logger.js';
import { sleep, sleepRandom, randomDelay } from '../utils/timing.js';
import { config } from '../config/index.js';

const SNAPCHAT_URL = 'https://web.snapchat.com/';

// System messages to filter out
const SYSTEM_MESSAGES = [
  'type a message',
  'send a chat',
  'send a snap',
  'click the camera',
  'tap to chat',
  'delivered',
  'opened',
  'received',
  'screenshot',
  'replayed',
  'new chat',
  'chat settings',
  'view profile',
  'say hi',
];

export interface Conversation {
  name: string;
  preview: string;
  hasUnread: boolean;
  isNewChat: boolean;
  isNewSnap: boolean;
}

export interface Message {
  text: string;
  isSent: boolean;
}

export async function navigateToSnapchat(page: Page): Promise<boolean> {
  logger.info('Navigating to Snapchat Web');

  try {
    await page.goto(SNAPCHAT_URL, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    await sleep(5000);
    return true;
  } catch (error) {
    logger.error('Failed to navigate to Snapchat', error);
    return false;
  }
}

export async function getConversations(page: Page): Promise<Conversation[]> {
  return await page.evaluate(() => {
    const conversations: Conversation[] = [];
    const seen = new Set<string>();

    const containers = document.querySelectorAll(
      '[role="listbox"] > *, [role="list"] > *, nav li, nav > div > div > div, aside > div > div, [class*="onversation"], [class*="chat"]'
    );

    for (const item of containers) {
      const text = (item as HTMLElement).innerText?.trim() || '';
      if (!text || text.length < 2 || text.length > 200) continue;

      const lines = text.split('\n').filter((l) => l.trim());
      const name = lines[0]?.trim();
      const preview = lines.slice(1).join(' ').trim().substring(0, 100);

      if (!name || name.length < 2 || seen.has(name)) continue;
      seen.add(name);

      const textLower = text.toLowerCase();

      // Check what status the chat shows
      const hasDelivered = textLower.includes('delivered');
      const hasSent = textLower.includes('sent') && !textLower.includes('received');
      const hasOpened = textLower.includes('opened');
      const hasReceived = textLower.includes('received');
      const hasNewChat = name === 'New Chat' || textLower.includes('new chat');
      const hasNewSnap = textLower.includes('new snap') || textLower.includes('new message');
      
      // STRICT RULE: If we sent the last message (Delivered/Sent/Opened), DO NOT open
      if (hasDelivered || hasSent || hasOpened) {
        conversations.push({
          name,
          preview,
          hasUnread: false,
          isNewChat: false,
          isNewSnap: false,
        });
        continue;
      }

      // Check for unread indicators (they sent us something)
      let hasUnread = false;

      // "Received" with time = they sent us a message we haven't opened
      if (/received\s*·?\s*\d+[mhs]/i.test(text)) {
        hasUnread = true;
      }

      // "Received" = they sent something
      if (hasReceived) {
        hasUnread = true;
      }

      // "New Chat" = someone new messaged us
      if (hasNewChat) {
        hasUnread = true;
      }

      // "New Snap" or "New Message" = unread
      if (hasNewSnap) {
        hasUnread = true;
      }

      // Check for notification elements (blue dot, badge, etc.)
      const el = item as HTMLElement;
      if (el.querySelector('[class*="notification"], [class*="badge"], [class*="dot"], [class*="unread"]')) {
        hasUnread = true;
      }

      // ONLY check bold if we have NO other status indicator
      // This prevents false positives from bold styling
      if (!hasUnread && !hasDelivered && !hasSent && !hasOpened && !hasReceived) {
        const firstSpan = el.querySelector('span, p');
        if (firstSpan) {
          const weight = parseInt(window.getComputedStyle(firstSpan).fontWeight);
          if (weight >= 600) {
            hasUnread = true;
          }
        }
      }

      const isNewChat = hasNewChat;

      conversations.push({
        name,
        preview,
        hasUnread: hasUnread || isNewChat || hasNewSnap,
        isNewChat,
        isNewSnap: hasNewSnap,
      });
    }

    return conversations;
  });
}

// Scroll conversation list to load more chats
export async function scrollConversationList(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Find the scrollable conversation container
    const scrollContainers = document.querySelectorAll(
      '[role="listbox"], [role="list"], [class*="scroll"], aside > div'
    );
    
    for (const container of scrollContainers) {
      const el = container as HTMLElement;
      // Check if this element is scrollable
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop += 300; // Scroll down 300px
        break;
      }
    }
  });
  
  await sleep(500); // Wait for new content to load
}

export async function openConversation(page: Page, name: string): Promise<boolean> {
  logger.info('Opening conversation', { name });

  // Method 1: Find element by text content and click
  try {
    const elements = await page.$$(
      '[role="listbox"] > *, [role="list"] > *, nav li, aside [role="button"], [class*="onversation"], [class*="Friend"]'
    );

    for (const el of elements) {
      const text = await el.innerText();
      if (text && text.includes(name)) {
        logger.debug('Found element, clicking');
        await el.click();
        await sleep(2000);
        return true;
      }
    }
  } catch (error) {
    logger.debug('Method 1 failed', error);
  }

  // Method 2: Text selector
  try {
    const el = await page.$(`text="${name}"`);
    if (el) {
      logger.debug('Found by text selector');
      await el.click();
      await sleep(2000);
      return true;
    }
  } catch (error) {
    logger.debug('Method 2 failed', error);
  }

  // Method 3: Click by coordinates
  try {
    const coords = await page.evaluate((targetName) => {
      const items = document.querySelectorAll('*');
      for (const item of items) {
        const text = (item as HTMLElement).innerText?.trim() || '';
        if (text.startsWith(targetName) && (item as HTMLElement).offsetWidth > 50) {
          const rect = (item as HTMLElement).getBoundingClientRect();
          if (rect.width > 50 && rect.height > 20) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          }
        }
      }
      return null;
    }, name);

    if (coords) {
      logger.debug('Found by coordinates', coords);
      await page.mouse.click(coords.x, coords.y);
      await sleep(2000);
      return true;
    }
  } catch (error) {
    logger.debug('Method 3 failed', error);
  }

  logger.warn('Failed to open conversation', { name });
  return false;
}

export async function getMessages(page: Page): Promise<Message[]> {
  await sleep(500);

  const systemMessages = SYSTEM_MESSAGES;

  return await page.evaluate((sysMessages) => {
    const messages: Message[] = [];
    const seen = new Set<string>();

    const mainArea = document.querySelector('[role="main"], main, [class*="Chat"], [class*="conversation"]');
    if (!mainArea) return [];

    const candidates = mainArea.querySelectorAll(
      '[class*="essage"], [class*="Bubble"], [class*="bubble"], [class*="chat"] p, [role="listitem"], [class*="Text"], p, span'
    );

    for (const el of candidates) {
      const text = (el as HTMLElement).innerText?.trim();
      if (!text || text.length < 1 || text.length > 500) continue;

      const textLower = text.toLowerCase();

      // Filter system messages
      if (sysMessages.some((sys) => textLower.includes(sys))) continue;

      // Filter timestamps
      if (/^\d+[mhs]$/.test(text)) continue;
      if (textLower === 'just now') continue;
      if (/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(text)) continue;

      // Skip header elements
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.top < 100) continue;

      // Skip duplicates
      if (seen.has(text)) continue;
      seen.add(text);

      // Determine if sent or received
      const parentRect = (el as HTMLElement).parentElement?.getBoundingClientRect();
      const isRightAligned = parentRect ? parentRect.left > window.innerWidth / 2 : false;

      const className = ((el as HTMLElement).className + ' ' + ((el as HTMLElement).parentElement?.className || '')).toLowerCase();
      const isSent =
        isRightAligned ||
        className.includes('sent') ||
        className.includes('outgoing') ||
        className.includes('self') ||
        className.includes('right') ||
        className.includes('own');

      messages.push({ text, isSent });
    }

    return messages.slice(-10);
  }, systemMessages);
}

export async function sendMessage(page: Page, text: string): Promise<boolean> {
  logger.info('Sending message', { preview: text.substring(0, 30) });

  // Find chat input (must be on right side, not search bar)
  const inputCoords = await page.evaluate(() => {
    const mainArea = document.querySelector('[role="main"], main, [class*="Chat"], [class*="onversation"]');
    if (mainArea) {
      const input = mainArea.querySelector('[contenteditable="true"], [role="textbox"], textarea');
      if (input) {
        const rect = (input as HTMLElement).getBoundingClientRect();
        if (rect.left > 300) {
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }
      }
    }

    // Fallback: find contenteditable on right side
    const inputs = document.querySelectorAll('[contenteditable="true"], [role="textbox"]');
    for (const input of inputs) {
      const rect = (input as HTMLElement).getBoundingClientRect();
      if (rect.left > 300 && rect.bottom > 400 && rect.width > 100) {
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
    }

    return null;
  });

  if (!inputCoords) {
    logger.error('Could not find chat input');
    return false;
  }

  // Click input
  await page.mouse.click(inputCoords.x, inputCoords.y);
  await sleepRandom(200, 400);

  // Type with human-like delays
  for (const char of text) {
    await page.keyboard.type(char);
    await sleep(randomDelay(config.typingDelayMin, config.typingDelayMax));
  }

  await sleepRandom(200, 500);
  await page.keyboard.press('Enter');

  logger.info('Message sent');
  return true;
}

export async function exitConversation(page: Page): Promise<void> {
  logger.debug('Exiting conversation');

  // Click neutral area first
  await page.mouse.click(10, 10);
  await sleep(300);

  // Press Escape multiple times
  await page.keyboard.press('Escape');
  await sleep(400);
  await page.keyboard.press('Escape');
  await sleep(400);

  // Try clicking back button
  try {
    const backButton = await page.$('[aria-label*="back" i], [aria-label*="Back"], button[class*="back" i]');
    if (backButton) {
      await backButton.click();
      await sleep(500);
    }
  } catch {
    // Ignore
  }

  // Click left panel area
  await page.mouse.click(150, 300);
  await sleep(300);

  // Verify exit
  const stillInChat = await page.evaluate(() => {
    return !!document.querySelector('[contenteditable="true"][class*="chat" i]');
  });

  if (stillInChat) {
    logger.debug('Still in chat, pressing Escape again');
    await page.keyboard.press('Escape');
    await sleep(200);
    await page.keyboard.press('Escape');
    await sleep(200);
    await page.mouse.click(100, 400);
    await sleep(500);
  }

  logger.debug('Exited conversation');
}

// UI elements and system items to always ignore
const UI_ELEMENTS = [
  'try the new snapchat',
  'try out lenses',
  'watch snapchat stories',
  'watch snapchat spotlight',
  'snapchat+',
  'stories',
  'spotlight',
  'lenses',
  'filters',
  'chat',
  'camera',
  'map',
  'discover',
  'search',
  'settings',
  'profile',
  'add friends',
  'my story',
];

export function filterConversations(conversations: Conversation[]): Conversation[] {
  return conversations.filter((c) => {
    const nameLower = c.name.toLowerCase();
    
    // Filter out UI elements
    const isUIElement = UI_ELEMENTS.some((ui) => nameLower.includes(ui));
    if (isUIElement) {
      return false;
    }
    
    // Filter out very short names (likely UI elements)
    if (c.name.length < 3) {
      return false;
    }
    
    // Filter based on user's ignore list
    const isIgnored = config.ignoreList.some((ignore) =>
      nameLower.includes(ignore.toLowerCase())
    );
    if (isIgnored) {
      logger.debug('Ignoring conversation', { name: c.name });
    }
    return !isIgnored;
  });
}

