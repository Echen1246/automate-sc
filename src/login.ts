// CLI login utility (fallback - prefer using dashboard)

import * as readline from 'readline';
import { launchForLogin, saveSession, closeBrowser } from './core/browser.js';
import { createSessionId, getSessionPath, ensureSessionsDir } from './sessions.js';
import { logger } from './utils/logger.js';
import { writeFileSync } from 'fs';

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
  console.log('');
  console.log('Snapchat Login Session Saver (CLI)');
  console.log('==================================');
  console.log('');
  console.log('NOTE: You can also login via the dashboard at http://localhost:3847');
  console.log('');

  const name = await prompt('Enter a name for this account: ');
  if (!name.trim()) {
    console.log('Name is required');
    process.exit(1);
  }

  const instance = await launchForLogin();

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

  // Create session
  ensureSessionsDir();
  const sessionId = createSessionId(name.trim());
  const sessionPath = getSessionPath(sessionId);

  // Save session with metadata
  const state = await instance.context.storageState();
  const stateWithMeta = {
    ...state,
    _meta: {
      name: name.trim(),
      createdAt: new Date().toISOString(),
      lastUsed: null,
    },
  };

  writeFileSync(sessionPath, JSON.stringify(stateWithMeta, null, 2));
  logger.info('Session saved', { sessionId, path: sessionPath });

  console.log('');
  console.log(`Session saved as: ${sessionId}`);
  console.log('Start the dashboard: npm run dashboard');

  await closeBrowser(instance);
  process.exit(0);
}

main().catch((error) => {
  logger.error('Login failed', error);
  process.exit(1);
});
