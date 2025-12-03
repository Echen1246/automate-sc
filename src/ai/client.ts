import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { SYSTEM_PROMPT, MAX_CONTEXT_MESSAGES, MAX_TOKENS } from './prompts.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIConfig {
  apiKey: string;
  model: string;
  temperature: number;
  personality: string;
}

// Current AI configuration (can be updated per-session)
let currentConfig: AIConfig = {
  apiKey: config.deepseekApiKey || '',
  model: 'deepseek-chat',
  temperature: 0.8,
  personality: SYSTEM_PROMPT,
};

let client: OpenAI | null = null;

export function initAI(sessionConfig?: Partial<AIConfig>): boolean {
  // Use session config if provided, otherwise use global
  const apiKey = sessionConfig?.apiKey || config.deepseekApiKey;
  
  if (!apiKey) {
    logger.warn('No API key set. Auto-reply disabled.');
    return false;
  }
  
  currentConfig = {
    apiKey,
    model: sessionConfig?.model || 'deepseek-chat',
    temperature: sessionConfig?.temperature ?? 0.8,
    personality: sessionConfig?.personality || SYSTEM_PROMPT,
  };
  
  client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: currentConfig.apiKey,
  });
  
  logger.info('AI initialized', { model: currentConfig.model });
  return true;
}

export function isAIReady(): boolean {
  return client !== null;
}

export function setSystemPrompt(prompt: string): void {
  currentConfig.personality = prompt;
  logger.info('System prompt updated', { length: prompt.length });
}

export function updateAIConfig(updates: Partial<AIConfig>): void {
  // If API key changes, reinitialize client
  if (updates.apiKey && updates.apiKey !== currentConfig.apiKey) {
    currentConfig.apiKey = updates.apiKey;
    client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: currentConfig.apiKey,
    });
    logger.info('AI client reinitialized with new API key');
  }
  
  if (updates.model) currentConfig.model = updates.model;
  if (updates.temperature !== undefined) currentConfig.temperature = updates.temperature;
  if (updates.personality) currentConfig.personality = updates.personality;
  
  logger.info('AI config updated', { model: currentConfig.model, temperature: currentConfig.temperature });
}

export function getSystemPrompt(): string {
  return currentConfig.personality;
}

export async function getResponse(
  userMessage: string,
  conversationHistory: Array<{ text: string; isSent: boolean }>
): Promise<string | null> {
  if (!client) {
    return null;
  }

  try {
    const history: ChatMessage[] = conversationHistory
      .slice(-MAX_CONTEXT_MESSAGES)
      .map((m) => ({
        role: m.isSent ? 'assistant' : 'user',
        content: m.text,
      }));

    const messages: ChatMessage[] = [
      { role: 'system', content: currentConfig.personality },
      ...history,
      { role: 'user', content: userMessage },
    ];

    logger.debug('Sending to AI', { messageCount: messages.length, model: currentConfig.model });

    const response = await client.chat.completions.create({
      model: currentConfig.model,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: currentConfig.temperature,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      logger.warn('Empty response from AI');
      return null;
    }

    logger.debug('AI response received', { preview: content.substring(0, 30) });
    return content;
  } catch (error) {
    logger.error('AI request failed', error);
    return null;
  }
}
