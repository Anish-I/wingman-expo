import type { LLMProvider } from './types.js';
import { createMockProvider } from './mock.js';
import { createOpenAIProvider } from './openai.js';

export type ProviderEnv = {
  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  OPENAI_API_KEY?: string;
};

export function pickProvider(env: ProviderEnv): LLMProvider {
  const wantsOpenAI = (env.LLM_PROVIDER ?? 'openai').toLowerCase() === 'openai';
  if (wantsOpenAI && env.OPENAI_API_KEY) {
    return createOpenAIProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.LLM_MODEL ?? 'gpt-5.5',
    });
  }
  return createMockProvider();
}
