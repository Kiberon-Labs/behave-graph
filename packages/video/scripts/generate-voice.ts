// Voiceover pipeline: narration script → one MP3 per scene → timing manifest.
//
//   corepack pnpm --filter @kiberon-labs/behave-graph-video voice
//
// Incremental: a scene whose text is unchanged since the last run (and whose MP3
// still exists) is skipped. Set VOICE_FORCE=1 to regenerate everything.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBuffer } from 'music-metadata';
import {
  narrationManifestSchema,
  type NarrationLine,
  type NarrationManifest
} from '../src/narration/manifest';
import { SCENES } from '../src/narration/script';
import { createProviderFromEnv } from './tts/index';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(packageRoot, 'public', 'narration');
const manifestPath = join(outDir, 'manifest.json');

// Keys live in packages/video/.env (gitignored); absence is fine, plain env works too.
try {
  process.loadEnvFile(join(packageRoot, '.env'));
} catch {
  // no .env file  rely on the process environment
}

const provider = createProviderFromEnv(process.env);
const force = process.env.VOICE_FORCE === '1';

const previous: NarrationManifest | null = await readFile(manifestPath, 'utf8')
  .then((raw) => narrationManifestSchema.parse(JSON.parse(raw)))
  .catch(() => null);

await mkdir(outDir, { recursive: true });

const lines: NarrationLine[] = [];
for (const scene of SCENES) {
  const file = `narration/${scene.id}.mp3`;
  const mp3Path = join(outDir, `${scene.id}.mp3`);

  const prior =
    previous?.provider === provider.name
      ? previous.lines.find((l) => l.id === scene.id)
      : undefined;
  const reusable =
    !force &&
    prior &&
    prior.text === scene.text &&
    (await readFile(mp3Path).then(
      () => true,
      () => false
    ));
  if (reusable) {
    console.log(
      `= ${scene.id} unchanged (${prior.durationSeconds.toFixed(1)}s)`
    );
    lines.push(prior);
    continue;
  }

  process.stdout.write(`> ${scene.id} … `);
  const { audio } = await provider.synthesize({
    id: scene.id,
    text: scene.text
  });
  await writeFile(mp3Path, audio);

  const meta = await parseBuffer(audio, { mimeType: 'audio/mpeg' });
  const durationSeconds = meta.format.duration;
  if (!durationSeconds || durationSeconds <= 0) {
    throw new Error(
      `could not read a duration from the generated MP3 for scene "${scene.id}"`
    );
  }
  console.log(`${durationSeconds.toFixed(1)}s`);
  lines.push({ id: scene.id, file, text: scene.text, durationSeconds });
}

const manifest: NarrationManifest = {
  provider: provider.name,
  generatedAt: new Date().toISOString(),
  lines
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const total = lines.reduce((s, l) => s + l.durationSeconds, 0);
console.log(
  `\nWrote ${lines.length} lines (${total.toFixed(1)}s of narration) → ${manifestPath}`
);
