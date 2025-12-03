import { chromium } from 'playwright-extra';
import type { BrowserContext, Page, Browser } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../utils/logger.js';

// Enable stealth mode
chromium.use(StealthPlugin());

const DEFAULT_SESSION_PATH = resolve(process.cwd(), 'data', 'sessions', 'default.json');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface BrowserInstance {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  sessionPath: string;
}

export async function hasSession(sessionPath?: string): Promise<boolean> {
  const path = sessionPath || DEFAULT_SESSION_PATH;
  return existsSync(path);
}

export async function launchBrowser(
  headless = false,
  sessionPath?: string
): Promise<BrowserInstance> {
  const path = sessionPath || DEFAULT_SESSION_PATH;
  logger.info('Launching browser', { sessionPath: path });

  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    viewport: { width: 1280, height: 800 },
    userAgent: USER_AGENT,
  };

  // Load existing session if available
  if (existsSync(path)) {
    logger.info('Loading existing session');
    contextOptions.storageState = path;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  return { browser, context, page, sessionPath: path };
}

export async function launchForLogin(): Promise<BrowserInstance> {
  logger.info('Launching browser for login');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: USER_AGENT,
  });

  const page = await context.newPage();

  return { browser, context, page, sessionPath: '' };
}

export async function saveSession(context: BrowserContext, sessionPath?: string): Promise<void> {
  const path = sessionPath || DEFAULT_SESSION_PATH;
  
  // Get new browser state
  const newState = await context.storageState();
  
  // Read existing file to preserve _meta, _config, _analytics
  let existingData: Record<string, unknown> = {};
  try {
    const { readFileSync } = await import('fs');
    const content = readFileSync(path, 'utf-8');
    existingData = JSON.parse(content);
  } catch {
    // File doesn't exist or can't be read, that's ok
  }
  
  // Merge: new cookies/origins + existing meta/config/analytics
  const merged = {
    ...newState,
    _meta: existingData._meta,
    _config: existingData._config,
    _analytics: existingData._analytics,
  };
  
  // Write merged data
  const { writeFileSync } = await import('fs');
  writeFileSync(path, JSON.stringify(merged, null, 2));
  
  logger.info('Session saved', { path });
}

export async function closeBrowser(instance: BrowserInstance): Promise<void> {
  await instance.browser.close();
  logger.info('Browser closed');
}

export function getDefaultSessionPath(): string {
  return DEFAULT_SESSION_PATH;
}
