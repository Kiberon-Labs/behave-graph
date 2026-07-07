// Turns the narration script + (optional) generated manifest into concrete frame
// ranges. With a manifest, every scene lasts exactly as long as its voice line
// plus a visual tail; without one, `fallbackSeconds` keeps the studio usable
// before any TTS key is configured.
import { staticFile } from 'remotion';
import { narrationManifestSchema, type NarrationManifest } from './manifest';
import { SCENES } from './script';

export interface SceneTiming {
  id: string;
  from: number;
  durationInFrames: number;
  /** `staticFile`-relative audio path, or null when no narration has been generated. */
  audioFile: string | null;
}

export async function loadNarrationManifest(): Promise<NarrationManifest | null> {
  try {
    const res = await fetch(staticFile('narration/manifest.json'));
    if (!res.ok) return null;
    return narrationManifestSchema.parse(await res.json());
  } catch {
    // Missing or invalid manifest → silent preview with fallback durations.
    return null;
  }
}

export function buildTimeline(
  manifest: NarrationManifest | null,
  fps: number
): { timings: SceneTiming[]; durationInFrames: number } {
  let from = 0;
  const timings = SCENES.map((scene) => {
    const line = manifest?.lines.find((l) => l.id === scene.id) ?? null;
    const seconds = line
      ? line.durationSeconds + (scene.tailSeconds ?? 1)
      : scene.fallbackSeconds;
    const durationInFrames = Math.max(1, Math.ceil(seconds * fps));
    const timing: SceneTiming = {
      id: scene.id,
      from,
      durationInFrames,
      audioFile: line?.file ?? null
    };
    from += durationInFrames;
    return timing;
  });
  return { timings, durationInFrames: from };
}
