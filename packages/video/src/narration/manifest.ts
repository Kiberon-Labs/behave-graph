// Shape of `public/narration/manifest.json`, written by `pnpm voice` and read by
// the composition to size scenes to their voice lines. Zod-validated on both
// sides so a stale or hand-edited manifest fails loudly instead of desyncing
// audio and video. No Remotion imports here  the Node-side TTS script imports
// this file too.
import { z } from 'zod';

export const narrationLineSchema = z.object({
  /** Scene id from `script.ts`. */
  id: z.string(),
  /** Path relative to `public/`, e.g. `narration/intro.mp3`. */
  file: z.string(),
  /** The text that was synthesized  lets `pnpm voice` skip lines that haven't changed. */
  text: z.string(),
  durationSeconds: z.number().positive()
});

export const narrationManifestSchema = z.object({
  provider: z.string(),
  generatedAt: z.string(),
  lines: z.array(narrationLineSchema)
});

export type NarrationLine = z.infer<typeof narrationLineSchema>;
export type NarrationManifest = z.infer<typeof narrationManifestSchema>;
