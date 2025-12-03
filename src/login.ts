import * as readline from 'readline';
import { launchBrowser, saveSession, closeBrowser, getSessionPath } from './core/browser.js';
import { logger } from './utils/logger.js';
import { sleep } from './utils/timing.js';

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  logger.info('Snapchat Login Session Saver');
  console.log('');
  console.log('This will open a browser window for you to log in.');
  console.log('After logging in and seeing your chats, press Enter here.');
  console.log('');

  const instance = await launchBrowser(false);

  logger.info('Opening Snapchat Web');
  await instance.page.goto('https://web.snapchat.com/', {
    waitUntil: 'domcontentloaded',
  });

  console.log('');
  console.log('Please log in to Snapchat Web in the browser window.');
  console.log('(You may need to scan a QR code with your phone)');
  console.log('');

  await prompt('Press Enter after you are logged in and can see your chats...');

  // Verify login
  try {
    await instance.page.waitForSelector('[aria-label="Chat"], [role="main"], nav', {
      timeout: 5000,
    });
    logger.info('Login verified');
  } catch {
    logger.warn('Could not verify login, saving session anyway');
  }

  // Save session
  await saveSession(instance.context);
  logger.info('Session saved', { path: getSessionPath() });

  console.log('');
  console.log('You can now run: npm start');

  await closeBrowser(instance);
  process.exit(0);
}

main().catch((error) => {
  logger.error('Login failed', error);
  process.exit(1);
});

