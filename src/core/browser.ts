import { chromium } from 'playwright-extra';
import type { BrowserContext, Page, Browser } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../utils/logger.js';

// Enable stealth mode
chromium.use(StealthPlugin());

const SESSION_PATH = resolve(process.cwd(), 'data', 'session.json');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface BrowserInstance {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function hasSession(): Promise<boolean> {
  return existsSync(SESSION_PATH);
}

export async function launchBrowser(headless = false): Promise<BrowserInstance> {
  logger.info('Launching browser');

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
  if (existsSync(SESSION_PATH)) {
    logger.info('Loading existing session');
    contextOptions.storageState = SESSION_PATH;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  return { browser, context, page };
}

export async function saveSession(context: BrowserContext): Promise<void> {
  await context.storageState({ path: SESSION_PATH });
  logger.info('Session saved');
}

export async function closeBrowser(instance: BrowserInstance): Promise<void> {
  await instance.browser.close();
  logger.info('Browser closed');
}

export function getSessionPath(): string {
  return SESSION_PATH;
}

