// OpenAI text-to-speech adapter  the fallback provider. Needs OPENAI_API_KEY;
// model and voice overridable via env.
import { z } from 'zod';
import type { TtsProvider } from './provider';

const envSchema = z.object({
  OPENAI_API_KEY: z
    .string()
    .min(1, 'OPENAI_API_KEY is required for the openai TTS provider'),
  OPENAI_TTS_MODEL: z.string().min(1).default('gpt-4o-mini-tts'),
  OPENAI_TTS_VOICE: z.string().min(1).default('onyx')
});

export function createOpenAiProvider(env: NodeJS.ProcessEnv): TtsProvider {
  const cfg = envSchema.parse({
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_TTS_MODEL: env.OPENAI_TTS_MODEL,
    OPENAI_TTS_VOICE: env.OPENAI_TTS_VOICE
  });
  return {
    name: 'openai',
    async synthesize({ id, text }) {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cfg.OPENAI_API_KEY}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: cfg.OPENAI_TTS_MODEL,
          voice: cfg.OPENAI_TTS_VOICE,
          input: text,
          response_format: 'mp3'
        })
      });
      if (!res.ok)
        throw new Error(
          `openai returned ${res.status} for scene "${id}": ${await res.text()}`
        );
      return { audio: new Uint8Array(await res.arrayBuffer()), format: 'mp3' };
    }
  };
}
