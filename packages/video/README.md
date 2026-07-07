# @kiberon-labs/behave-graph-video

Marketing & demo video generation for behave-graph, built on [Remotion](https://remotion.dev). **Never published**  this package exists to produce MP4s (and the thumbnail PNG).

The flagship composition, `DemoTour`, is a narrated walkthrough of the engine + editor. It doesn't fake the UI: every editor scene **mounts the real Flow editor** (`System` → `createSession` → `LayoutController`, the same wiring as the docs-site embed) with an example graph from `graphs/`, themed via the flow package's own `data-flow-theme="kiberon"`.

This mirrors the graph-grammar tour video (`graph-grammar/apps/video`)  same aesthetic (purplish-Linear brand look), same narration→manifest retiming pipeline, same swappable TTS adapter and voice.

## Usage

From the repo root:

```sh
corepack pnpm install
corepack pnpm build --filter=@kiberon-labs/behave-graph-flow   # editor must be built first

# 1. One-time asset generation
corepack pnpm video:image-demo      # before → after payoff for the image scene

# 2. Generate the voiceover (once, and after script edits)
cp packages/video/.env.example packages/video/.env   # add ELEVENLABS_API_KEY (or TTS_PROVIDER=openai)
corepack pnpm video:voice

# 3. Preview / iterate
corepack pnpm video                 # Remotion studio

# 4. Render
corepack pnpm video:render          # → packages/video/out/demo-tour.mp4
corepack pnpm video:thumbnail       # → packages/video/out/thumbnail.png
```

Scene lengths are never hardcoded: `calculateMetadata` reads the narration manifest and sizes every scene to its voice line. With no manifest, scenes use `fallbackSeconds` and play silent  the studio works before any API key is configured.

## Editing the tour

- **Change what's said / shown**: edit `src/narration/script.ts`. Editor scenes reference a graph by key (`src/compositions/graphs.ts`  bundled examples from `graphs/` or authored pipelines), an optional `runAt` fraction to start the local graph runner on camera, and `imageNodes`/`imagePayoff` for the ImageMagick scene. Then rerun `pnpm video:voice`.
- **Voice**: `scripts/tts/` is the same swappable adapter as the graph-grammar video (ElevenLabs default, voice "George", OpenAI via `TTS_PROVIDER=openai`). Keep the voice id consistent across Kiberon videos.

## How scenes drive the editor

Scenes are driven through the editor's REAL stores, so the video reads as someone using the tool (`src/compositions/scenes/EditorScene.tsx`):

- **Authored layouts**: every demo graph carries `metadata.positionX/Y` (`graphs.ts`). The editor's mount path round-trips through `flowToBehave` (which drops position metadata) and re-layouts, so a `nodeStore` subscription re-asserts positions/selection/edits idempotently.
- **`actions`**: scene-fraction waypoints that select nodes (Node Inputs panel populates), edit params, open panels (`logs`, `traces`, `variables`, `events`), and start runs.
- **`stepDelayMs`**: the runner's own pacing setting  slows execution so nodes visibly light up (an execution cursor derived from real trace spans; the built-in flash is sub-frame) and keeps spans inside the traces panel's rolling window. Also flips on the runner's `enableTracing` toggle (off by default).
- **Image scenes**: `imageNodes` registers the ImageMagick pack + its UI plugin (RealtimeRunner → inline per-node previews, `image.showPreview` on); `aiNodes` registers the AI pack.

## Determinism caveats

- `Config.setConcurrency(1)` is set project-wide: the runner executes on timers as frames advance, so parallel render chunks would each cold-start the run with only a handful of frames. Sequential rendering keeps execution, logs, traces and previews progressing exactly once, in order.
- The image scene's before → after card is pre-generated (`pnpm video:image-demo`) with the same ImageMagick-wasm ops the on-screen graph performs (resize → oil-paint → sepia on the public-domain Pillars of Creation photo), so the payoff never depends on in-browser wasm timing.
