/**
 * Snapper - Snapchat Web Chatbot with DeepSeek AI
 * 
 * Polls for new messages, auto-opens chats, responds, then exits back to list.
 */

import 'dotenv/config';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE_PATH = path.join(__dirname, '..', 'storage-state.json');

chromium.use(StealthPlugin());

// =========================================
// CONFIGURATION
// =========================================
const CONFIG = {
  // Polling
  pollIntervalMin: 2000,    // Min time between polls (ms)
  pollIntervalMax: 5000,    // Max time between polls (ms)
  
  // Response delays (appear human)
  responseDelayMin: 1500,   // Min delay before responding
  responseDelayMax: 4000,   // Max delay before responding
  typingDelayMin: 30,       // Min ms between keystrokes
  typingDelayMax: 80,       // Max ms between keystrokes
  
  // DeepSeek API
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekModel: 'deepseek-chat',
  
  // Behavior
  autoReply: true,          // Auto-reply to messages
  debug: process.env.DEBUG === '1',
  
  // Ignore these conversations (exact match or includes)
  ignoreList: ['My AI', 'Team Snapchat']
};

// System prompt for the chatbot
const SYSTEM_PROMPT = `You are a real person chatting casually on Snapchat. Rules:
- Keep responses SHORT (1-2 sentences max, like real texting)
- Use all lowercase unless emphasizing something
- Use emojis occasionally but not excessively
- Match the other person's vibe and energy
- Be flirty/friendly if they are, be chill if they are
- You are an Onlyfans model. If they ask about your Onlyfans, tell them you talk on Twitter.
- NEVER mention being an AI or bot
- Don't be overly helpful or formal - be natural
- If they ask what you're doing, make up something casual
- Reference the conversation naturally`;

// =========================================
// DEEPSEEK CLIENT
// =========================================
let deepseek = null;

function initDeepSeek() {
  if (CONFIG.deepseekApiKey === 'YOUR_API_KEY_HERE') {
    console.log('⚠️  No DeepSeek API key set. Set DEEPSEEK_API_KEY env var.');
    console.log('   Responses will be disabled until you add a key.\n');
    return false;
  }
  
  deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: CONFIG.deepseekApiKey
  });
  
  console.log('✓ DeepSeek API initialized\n');
  return true;
}

async function getAIResponse(message, conversationHistory = []) {
  if (!deepseek) return null;
  
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-10), // Last 10 messages for context
      { role: 'user', content: message }
    ];
    
    const response = await deepseek.chat.completions.create({
      model: CONFIG.deepseekModel,
      messages,
      max_tokens: 150,
      temperature: 0.8
    });
    
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.log(`   ❌ DeepSeek error: ${e.message}`);
    return null;
  }
}

// =========================================
// UTILITY FUNCTIONS
// =========================================

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg) {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${msg}`);
}

// =========================================
// MAIN
// =========================================

async function main() {
  console.log('🔮 Snapper - Snapchat Chatbot with DeepSeek AI');
  console.log('━'.repeat(50));
  
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    console.log('\n⚠ No saved session. Run `npm run save-cookies` first.');
    process.exit(1);
  }
  
  // Initialize DeepSeek
  const hasAI = initDeepSeek();
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ 
    storageState: STORAGE_STATE_PATH,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  
  // State tracking
  const conversationHistories = new Map(); // name -> messages[]
  const processedMessages = new Set();      // track already-replied messages
  let currentOpenChat = null;

  // =========================================
  // NAVIGATE
  // =========================================
  console.log('🌐 Opening Snapchat Web...');
  await page.goto('https://web.snapchat.com/', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });

  console.log('⏳ Waiting for page to load...');
  await sleep(5000);
  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log('✓ Page loaded, session saved\n');

  // =========================================
  // DOM FUNCTIONS
  // =========================================
  
  async function getConversations() {
    return await page.evaluate(() => {
      const conversations = [];
      
      // Try to find conversation items
      const possibleContainers = document.querySelectorAll(
        '[role="listbox"] > *, [role="list"] > *, nav li, nav > div > div > div, aside > div > div, [class*="onversation"], [class*="chat"]'
      );
      
      for (const item of possibleContainers) {
        const text = item.innerText?.trim() || '';
        if (!text || text.length < 2 || text.length > 200) continue;
        
        const lines = text.split('\n').filter(l => l.trim());
        const name = lines[0]?.trim();
        const preview = lines.slice(1).join(' ').trim().substring(0, 100);
        
        if (!name || name.length < 2) continue;
        
        // Check for unread indicators
        const hasUnread = (() => {
          const el = item;
          const textLower = text.toLowerCase();
          const previewLower = preview.toLowerCase();
          
          // "Received" with a time indicator (like "2m", "54m", "1h") = definitely unread
          // This is the most reliable indicator on Snapchat
          if (/received\s*·?\s*\d+[mhs]/i.test(text)) {
            console.log('[DEBUG] Found "Received" time indicator in:', name);
            return true;
          }
          
          // "Received" without "Opened" means unread
          if (textLower.includes('received') && !textLower.includes('opened')) {
            console.log('[DEBUG] Found "Received" without "Opened" in:', name);
            return true;
          }
          
          // "New Chat" is always unread - it's a new message request
          if (name === 'New Chat' || textLower.includes('new chat')) {
            console.log('[DEBUG] Found "New Chat":', name);
            return true;
          }
          
          // "New snap" or "New message" indicators
          if (textLower.includes('new snap') || textLower.includes('new message')) {
            return true;
          }
          
          // Look for notification dots/badges in class names
          if (el.querySelector('[class*="notification"], [class*="badge"], [class*="dot"], [class*="unread"], [class*="Unread"]')) {
            return true;
          }
          
          // Check for aria-labels
          if (el.querySelector('[aria-label*="unread" i], [aria-label*="new" i]')) {
            return true;
          }
          
          // Check for blue dot elements (Snapchat's unread indicator)
          const allEls = el.querySelectorAll('*');
          for (const child of allEls) {
            const style = window.getComputedStyle(child);
            const bg = style.backgroundColor;
            const width = child.offsetWidth;
            const height = child.offsetHeight;
            
            // Small blue/colored circle = unread indicator
            if (width < 15 && height < 15 && width > 3) {
              if (bg.includes('0, 1') || bg.includes('0, 2') || bg.includes('55, 1') || 
                  bg.includes('rgb(0') || style.background?.includes('blue')) {
                return true;
              }
            }
          }
          
          // Check for bold text (unread indicator)
          const firstSpan = el.querySelector('span, p');
          if (firstSpan) {
            const weight = parseInt(window.getComputedStyle(firstSpan).fontWeight);
            if (weight >= 600) {
              return true;
            }
          }
          
          return false;
        })();
        
        // Also check if this is a "New Chat" request
        const isNewChat = name === 'New Chat' || name.toLowerCase().includes('new chat');
        
        conversations.push({
          name,
          preview,
          hasUnread: hasUnread || isNewChat,
          isNewChat,
          element: item
        });
      }
      
      // Dedupe by name
      const seen = new Set();
      return conversations.filter(c => {
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
      });
    });
  }
  
  async function openConversation(name) {
    log(`📂 Opening chat: ${name}`);
    
    // Try multiple methods to click on the conversation
    
    // Method 1: Find element and use Playwright's click
    try {
      // Get all potential conversation elements
      const elements = await page.$$('[role="listbox"] > *, [role="list"] > *, nav li, aside [role="button"], [class*="onversation"], [class*="Friend"]');
      
      for (const el of elements) {
        const text = await el.innerText();
        if (text && text.includes(name)) {
          log(`   Found element with text, clicking...`);
          await el.click();
          await sleep(2000); // Wait for chat to load
          currentOpenChat = name;
          return true;
        }
      }
    } catch (e) {
      log(`   Method 1 failed: ${e.message}`);
    }
    
    // Method 2: Use text selector
    try {
      const textSelector = `text="${name}"`;
      const el = await page.$(textSelector);
      if (el) {
        log(`   Found by text selector, clicking...`);
        await el.click();
        await sleep(2000);
        currentOpenChat = name;
        return true;
      }
    } catch (e) {
      log(`   Method 2 failed: ${e.message}`);
    }
    
    // Method 3: Click via coordinates (find element position and click)
    try {
      const coords = await page.evaluate((targetName) => {
        const items = document.querySelectorAll('*');
        for (const item of items) {
          const text = item.innerText?.trim() || '';
          if (text.startsWith(targetName) && item.offsetWidth > 50) {
            const rect = item.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 20) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            }
          }
        }
        return null;
      }, name);
      
      if (coords) {
        log(`   Found at (${coords.x}, ${coords.y}), clicking...`);
        await page.mouse.click(coords.x, coords.y);
        await sleep(2000);
        currentOpenChat = name;
        return true;
      }
    } catch (e) {
      log(`   Method 3 failed: ${e.message}`);
    }
    
    log(`   ❌ Could not click conversation: ${name}`);
    return false;
  }
  
  async function getMessagesInCurrentChat() {
    // Wait a moment for messages to render
    await sleep(500);
    
    return await page.evaluate(() => {
      const messages = [];
      
      // Snapchat's chat area is usually in the right/main panel
      // Look for any text containers in the main content area
      const mainArea = document.querySelector('[role="main"], main, [class*="Chat"], [class*="conversation"]');
      
      if (!mainArea) {
        console.log('[DEBUG] No main chat area found');
        return [];
      }
      
      // Get all potential message containers
      const selectors = [
        '[class*="essage"]',
        '[class*="Bubble"]', 
        '[class*="bubble"]',
        '[class*="chat"] p',
        '[class*="Chat"] span',
        '[role="listitem"]',
        // Snapchat specific patterns
        '[class*="Text"]',
        'p',
        'span'
      ];
      
      const candidates = mainArea.querySelectorAll(selectors.join(', '));
      console.log('[DEBUG] Found', candidates.length, 'potential message elements');
      
      for (const el of candidates) {
        const text = el.innerText?.trim();
        
        // Filter out non-message text (system messages, UI elements)
        if (!text || text.length < 1 || text.length > 500) continue;
        
        // Skip UI elements and system messages
        const systemMessages = [
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
          'view profile'
        ];
        const textLower = text.toLowerCase();
        if (systemMessages.some(sys => textLower.includes(sys))) continue;
        
        // Skip timestamps like "2m", "1h", "just now"
        if (/^\d+[mhs]$/.test(text)) continue;
        if (text.toLowerCase() === 'just now') continue;
        if (/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(text)) continue;
        
        // Check position - messages are usually not at the very top
        const rect = el.getBoundingClientRect();
        if (rect.top < 100) continue; // Skip header elements
        
        // Try to determine if sent or received based on position
        const parentRect = el.parentElement?.getBoundingClientRect();
        const isRightAligned = parentRect ? parentRect.left > window.innerWidth / 2 : false;
        
        // Also check classes
        const className = (el.className + ' ' + (el.parentElement?.className || '')).toLowerCase();
        const isSent = 
          isRightAligned ||
          className.includes('sent') || 
          className.includes('outgoing') ||
          className.includes('self') ||
          className.includes('right') ||
          className.includes('own');
        
        messages.push({
          text: text.substring(0, 500),
          isSent,
          id: `${text.substring(0, 20)}-${messages.length}`
        });
      }
      
      // Dedupe and return last messages
      const seen = new Set();
      const unique = messages.filter(m => {
        if (seen.has(m.text)) return false;
        seen.add(m.text);
        return true;
      });
      
      console.log('[DEBUG] Found', unique.length, 'unique messages');
      return unique.slice(-10);
    });
  }
  
  async function sendMessage(text) {
    log(`   ✉️ Sending: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    // Find the CHAT input field specifically (not search bar)
    // The chat input is usually in the main/right area, not the left sidebar
    const chatInput = await page.evaluate(() => {
      // Look for contenteditable in the main chat area
      const mainArea = document.querySelector('[role="main"], main, [class*="Chat"], [class*="onversation"]');
      if (mainArea) {
        const input = mainArea.querySelector('[contenteditable="true"], [role="textbox"], textarea');
        if (input) {
          // Get position to verify it's not in the sidebar
          const rect = input.getBoundingClientRect();
          if (rect.left > 300) { // Should be on right side
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
          }
        }
      }
      
      // Fallback: find any contenteditable that's on the right side
      const inputs = document.querySelectorAll('[contenteditable="true"], [role="textbox"]');
      for (const input of inputs) {
        const rect = input.getBoundingClientRect();
        // Chat input should be: on right side (x > 300), near bottom, reasonably sized
        if (rect.left > 300 && rect.bottom > 400 && rect.width > 100) {
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
        }
      }
      
      return { found: false };
    });
    
    if (!chatInput.found) {
      log('   ❌ Could not find chat input field');
      return false;
    }
    
    // Click on the chat input specifically
    await page.mouse.click(chatInput.x, chatInput.y);
    await sleep(randomDelay(200, 400));
    
    // Type with human-like delays
    for (const char of text) {
      await page.keyboard.type(char);
      await sleep(randomDelay(CONFIG.typingDelayMin, CONFIG.typingDelayMax));
    }
    
    await sleep(randomDelay(200, 500));
    await page.keyboard.press('Enter');
    
    return true;
  }
  
  /**
   * Exit current chat and go back to conversation list
   */
  async function exitChat() {
    log('   ← Exiting chat...');
    
    // Click somewhere neutral first to unfocus any input
    await page.mouse.click(10, 10);
    await sleep(300);
    
    // Method 1: Press Escape multiple times
    await page.keyboard.press('Escape');
    await sleep(400);
    await page.keyboard.press('Escape');
    await sleep(400);
    
    // Method 2: Try clicking back button/arrow
    try {
      const backButton = await page.$('[aria-label*="back" i], [aria-label*="Back"], button[class*="back" i], [class*="BackButton"], svg[class*="arrow"]');
      if (backButton) {
        await backButton.click();
        await sleep(500);
      }
    } catch (e) {}
    
    // Method 3: Click on the left panel (conversation list area)
    try {
      await page.mouse.click(150, 300); // Left side of screen
      await sleep(300);
    } catch (e) {}
    
    // Verify we exited - check if we're still seeing a chat input
    const stillInChat = await page.evaluate(() => {
      const chatInput = document.querySelector('[contenteditable="true"][class*="chat" i], [role="textbox"][class*="chat" i]');
      return !!chatInput;
    });
    
    if (stillInChat) {
      log('   ⚠️ Still in chat, trying harder to exit...');
      await page.keyboard.press('Escape');
      await sleep(200);
      await page.keyboard.press('Escape');
      await sleep(200);
      // Click on left side
      await page.mouse.click(100, 400);
      await sleep(500);
    }
    
    currentOpenChat = null;
    log('   ✓ Exited chat');
  }

  // =========================================
  // MESSAGE HANDLER
  // =========================================
  
  async function handleUnreadConversation(conv) {
    log(`\n🔔 NEW MESSAGE from: ${conv.name}`);
    if (conv.preview) {
      log(`   Preview: "${conv.preview}"`);
    }
    
    // Open the conversation
    const opened = await openConversation(conv.name);
    if (!opened) {
      return;
    }
    
    // Wait for messages to load
    await sleep(randomDelay(1000, 2000));
    
    // Get all messages in the chat
    const messages = await getMessagesInCurrentChat();
    log(`   Found ${messages.length} messages in chat`);
    
    if (messages.length === 0) {
      log('   No messages found in chat');
      await exitChat();
      return;
    }
    
    // Find the last received message (not sent by us)
    const receivedMessages = messages.filter(m => !m.isSent);
    const lastReceived = receivedMessages[receivedMessages.length - 1];
    
    if (!lastReceived) {
      log('   No received messages found (only our messages visible)');
      await exitChat();
      return;
    }
    
    log(`   Last message from them: "${lastReceived.text}"`);
    
    // Check if we already processed this exact message
    const messageKey = `${conv.name}:${lastReceived.text}`;
    if (processedMessages.has(messageKey)) {
      log('   Already replied to this message');
      await exitChat();
      return;
    }
    
    // Build conversation history from the visible messages
    // This gives the AI full context of the conversation
    const chatHistory = messages.map(m => ({
      role: m.isSent ? 'assistant' : 'user',
      content: m.text
    }));
    
    log(`   📜 Sending ${chatHistory.length} messages as context to AI`);
    
    // Auto-reply if enabled and we have AI
    if (CONFIG.autoReply && deepseek) {
      // Human-like delay before responding
      const delay = randomDelay(CONFIG.responseDelayMin, CONFIG.responseDelayMax);
      log(`   ⏳ Thinking for ${(delay / 1000).toFixed(1)}s...`);
      await sleep(delay);
      
      // Get AI response with FULL chat context
      const response = await getAIResponse(lastReceived.text, chatHistory);
      
      if (response) {
        // Send the message
        const sent = await sendMessage(response);
        
        if (sent) {
          processedMessages.add(messageKey);
          log('   ✓ Response sent!');
        }
      } else {
        log('   ❌ No response from AI');
      }
    } else {
      processedMessages.add(messageKey);
      log('   (Auto-reply disabled or no API key)');
    }
    
    // Wait a moment, then exit back to conversation list
    await sleep(randomDelay(800, 1500));
    await exitChat();
  }

  // =========================================
  // POLLING LOOP
  // =========================================
  
  let pollCount = 0;
  
  async function pollForMessages() {
    pollCount++;
    
    try {
      const conversations = await getConversations();
      
      // Filter out ignored conversations
      const filtered = conversations.filter(c => {
        const isIgnored = CONFIG.ignoreList.some(ignore => 
          c.name.toLowerCase().includes(ignore.toLowerCase())
        );
        if (isIgnored && CONFIG.debug) {
          log(`   [Ignoring: ${c.name}]`);
        }
        return !isIgnored;
      });
      
      const unread = filtered.filter(c => c.hasUnread);
      const newChats = filtered.filter(c => c.isNewChat);
      
      // Always log poll activity so user knows it's working
      if (pollCount % 5 === 0 || unread.length > 0 || CONFIG.debug) {
        log(`[Poll #${pollCount}] ${filtered.length} convos, ${unread.length} unread, ${newChats.length} new chats`);
      }
      
      if (CONFIG.debug && filtered.length > 0) {
        filtered.forEach(c => {
          log(`   - ${c.hasUnread ? '🔴' : '⚪'} ${c.name}: "${c.preview?.substring(0, 40) || 'no preview'}"`);
        });
      }
      
      // Handle each unread conversation
      if (unread.length > 0) {
        log(`\n📬 ${unread.length} unread conversation(s) to process...`);
        
        for (const conv of unread) {
          await handleUnreadConversation(conv);
          
          // Random delay between handling multiple unread
          if (unread.length > 1) {
            await sleep(randomDelay(2000, 4000));
          }
        }
      }
      
    } catch (e) {
      log(`[Poll Error] ${e.message}`);
      if (CONFIG.debug) {
        console.error(e);
      }
    }
    
    // Schedule next poll with random interval
    const nextPoll = randomDelay(CONFIG.pollIntervalMin, CONFIG.pollIntervalMax);
    setTimeout(pollForMessages, nextPoll);
  }
  
  // =========================================
  // INITIAL SCAN & START
  // =========================================
  
  console.log('📋 Initial conversation scan...');
  const initial = await getConversations();
  
  if (initial.length === 0) {
    console.log('⚠️ No conversations found. Possible issues:');
    console.log('   1. Page still loading - waiting 5 more seconds...');
    await sleep(5000);
    
    const retry = await getConversations();
    if (retry.length === 0) {
      console.log('   2. Need to re-login: run npm run save-cookies');
      console.log('   3. Snapchat UI changed - selectors may need updating');
      console.log('\n   Continuing anyway - will keep polling...');
    } else {
      console.log(`   ✓ Found ${retry.length} conversations on retry`);
    }
  } else {
    console.log(`Found ${initial.length} conversations:`);
    initial.slice(0, 8).forEach((c, i) => {
      const status = c.hasUnread ? '🔴 UNREAD' : '⚪';
      const preview = c.preview ? ` - "${c.preview.substring(0, 30)}..."` : '';
      console.log(`   ${i + 1}. ${status} ${c.name}${preview}`);
    });
    if (initial.length > 8) {
      console.log(`   ... and ${initial.length - 8} more`);
    }
  }
  
  console.log('\n' + '━'.repeat(50));
  console.log('👀 Starting continuous message monitoring...');
  console.log(`   Poll interval: ${CONFIG.pollIntervalMin/1000}-${CONFIG.pollIntervalMax/1000}s (randomized)`);
  console.log(`   Auto-reply: ${CONFIG.autoReply && deepseek ? '✓ Enabled' : '✗ Disabled'}`);
  console.log('   Logs every 5th poll (or when unread found)');
  console.log('\n   Press Ctrl+C to stop');
  console.log('━'.repeat(50) + '\n');
  
  // Start the polling loop
  log('[Poll #1] Starting first poll...');
  pollForMessages();
  
  // Keep process running
  await new Promise(() => {});
}

process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down Snapper...');
  process.exit(0);
});

main().catch(console.error);
