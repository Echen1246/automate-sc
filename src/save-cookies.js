/**
 * Cookie Saver Utility
 * 
 * Opens a browser for manual login, then saves the session
 * for use by the main script.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE_PATH = path.join(__dirname, '..', 'storage-state.json');

// Enable stealth mode
chromium.use(StealthPlugin());

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🔐 Snapchat Web Cookie Saver');
  console.log('━'.repeat(50));
  console.log('\nThis will open a browser window for you to log in.');
  console.log('After logging in and seeing your chats, press Enter here.\n');

  // Launch browser with stealth
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  
  console.log('🌐 Opening Snapchat Web...');
  await page.goto('https://web.snapchat.com/', { 
    waitUntil: 'domcontentloaded' 
  });

  console.log('\n📱 Please log in to Snapchat Web in the browser window.');
  console.log('   (You may need to scan a QR code with your phone)\n');
  
  await prompt('Press Enter after you are logged in and can see your chats...');

  // Verify login by checking for chat elements
  try {
    await page.waitForSelector('[aria-label="Chat"], [role="main"], nav', { 
      timeout: 5000 
    });
    console.log('✓ Login detected!');
  } catch {
    console.log('⚠ Could not verify login, but saving session anyway...');
  }

  // Save the storage state (cookies + localStorage)
  await context.storageState({ path: STORAGE_STATE_PATH });
  
  console.log(`\n✓ Session saved to: ${STORAGE_STATE_PATH}`);
  console.log('\nYou can now run `npm start` to monitor messages.');
  
  await browser.close();
  process.exit(0);
}

main().catch(console.error);

