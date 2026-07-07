// ElevenLabs adapter  the default provider. Needs ELEVENLABS_API_KEY; voice
// and model are overridable via env. Keep the voice id in sync with the
// graph-grammar tour video so the Kiberon narrator stays consistent.
import { z } from 'zod';
import type { TtsProvider } from './provider';

const envSchema = z.object({
  ELEVENLABS_API_KEY: z
    .string()
    .min(1, 'ELEVENLABS_API_KEY is required for the elevenlabs TTS provider'),
  // "George"  a calm British narration voice from the default library.
  ELEVENLABS_VOICE_ID: z.string().min(1).default('JBFqnCBsd6RMkjVDRZzb'),
  ELEVENLABS_MODEL_ID: z.string().min(1).default('eleven_multilingual_v2')
});

export function createElevenLabsProvider(env: NodeJS.ProcessEnv): TtsProvider {
  const cfg = envSchema.parse({
    ELEVENLABS_API_KEY: env.ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID: env.ELEVENLABS_VOICE_ID,
    ELEVENLABS_MODEL_ID: env.ELEVENLABS_MODEL_ID
  });
  return {
    name: 'elevenlabs',
    async synthesize({ id, text }) {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${cfg.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': cfg.ELEVENLABS_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ text, model_id: cfg.ELEVENLABS_MODEL_ID })
      });
      if (!res.ok)
        throw new Error(
          `elevenlabs returned ${res.status} for scene "${id}": ${await res.text()}`
        );
      return { audio: new Uint8Array(await res.arrayBuffer()), format: 'mp3' };
    }
  };
}
