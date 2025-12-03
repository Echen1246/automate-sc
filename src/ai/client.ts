import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { SYSTEM_PROMPT, MAX_CONTEXT_MESSAGES, MAX_TOKENS, TEMPERATURE } from './prompts.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

let client: OpenAI | null = null;

export function initAI(): boolean {
  if (!config.deepseekApiKey) {
    logger.warn('No DeepSeek API key set. Auto-reply disabled.');
    return false;
  }

  client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey,
  });

  logger.info('DeepSeek AI initialized');
  return true;
}

export function isAIReady(): boolean {
  return client !== null;
}

export async function getResponse(
  userMessage: string,
  conversationHistory: Array<{ text: string; isSent: boolean }>
): Promise<string | null> {
  if (!client) {
    return null;
  }

  try {
    // Build message history
    const history: ChatMessage[] = conversationHistory
      .slice(-MAX_CONTEXT_MESSAGES)
      .map((m) => ({
        role: m.isSent ? 'assistant' : 'user',
        content: m.text,
      }));

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userMessage },
    ];

    logger.debug('Sending to AI', { messageCount: messages.length });

    const response = await client.chat.completions.create({
      model: config.deepseekModel,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
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

