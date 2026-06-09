import type { LLMProvider } from './types.js';
import { createMockProvider } from './mock.js';
import { createOpenAIProvider } from './openai.js';

export type ProviderEnv = {
  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
};

export function pickProvider(env: ProviderEnv): LLMProvider {
  const requested = (env.LLM_PROVIDER ?? 'openai').toLowerCase();
  // DeepSeek speaks the OpenAI chat-completions + tool-calling protocol, so it
  // rides the same provider with a different base URL.
  if (requested === 'deepseek' && env.DEEPSEEK_API_KEY) {
    return createOpenAIProvider({
      apiKey: env.DEEPSEEK_API_KEY,
      model: env.LLM_MODEL && !env.LLM_MODEL.startsWith('gpt-') ? env.LLM_MODEL : 'deepseek-chat',
      baseURL: 'https://api.deepseek.com',
      id: 'deepseek',
    });
  }
  if (requested === 'openai' && env.OPENAI_API_KEY) {
    return createOpenAIProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.LLM_MODEL ?? 'gpt-5.5',
    });
  }
  return createMockProvider();
}
