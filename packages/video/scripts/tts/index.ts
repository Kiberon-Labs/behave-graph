// Provider factory: TTS_PROVIDER picks the adapter (default elevenlabs); each
// adapter fail-fast validates its own keys with Zod.
import { z } from 'zod';
import { createElevenLabsProvider } from './elevenlabs';
import { createOpenAiProvider } from './openai';
import type { TtsProvider } from './provider';

const providerName = z.enum(['elevenlabs', 'openai']).default('elevenlabs');

export function createProviderFromEnv(env: NodeJS.ProcessEnv): TtsProvider {
  const name = providerName.parse(env.TTS_PROVIDER);
  switch (name) {
    case 'elevenlabs':
      return createElevenLabsProvider(env);
    case 'openai':
      return createOpenAiProvider(env);
  }
}
