import type { LLMProvider } from './types.js';
import { createMockProvider } from './mock.js';
import { createOpenAIProvider } from './openai.js';

export type ProviderEnv = {
  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  LLM_BASE_URL?: string;
};

export function pickProvider(env: ProviderEnv): LLMProvider {
  const provider = (env.LLM_PROVIDER ?? 'openai').toLowerCase();

  // DeepSeek is OpenAI-compatible — same client, different base URL + key.
  if (provider === 'deepseek' && env.DEEPSEEK_API_KEY) {
    return createOpenAIProvider({
      id: 'deepseek',
      apiKey: env.DEEPSEEK_API_KEY,
      model: env.LLM_MODEL ?? 'deepseek-chat',
      baseURL: env.LLM_BASE_URL ?? 'https://api.deepseek.com',
    });
  }

  if (provider === 'openai' && env.OPENAI_API_KEY) {
    return createOpenAIProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.LLM_MODEL ?? 'gpt-5.5',
      baseURL: env.LLM_BASE_URL,
    });
  }

  return createMockProvider();
}
