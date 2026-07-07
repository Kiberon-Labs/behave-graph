// Composition registry. Scene lengths are not hardcoded: calculateMetadata loads
// the narration manifest (if `pnpm voice` has been run) and sizes every scene to
// its voice line  regenerating the voiceover retimes the whole video for free.
import { Composition, Still } from 'remotion';
import { DemoTour, type DemoTourProps } from './compositions/DemoTour';
import { Thumbnail } from './compositions/Thumbnail';
import { buildTimeline, loadNarrationManifest } from './narration/timeline';

export const FPS = 30;

export function RemotionRoot() {
  const fallback = buildTimeline(null, FPS);
  return (
    <>
      <Still id="Thumbnail" component={Thumbnail} width={1920} height={1080} />
      <Composition
        id="DemoTour"
        component={DemoTour}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={fallback.durationInFrames}
        defaultProps={{ timings: fallback.timings } satisfies DemoTourProps}
        calculateMetadata={async ({ props }) => {
          const manifest = await loadNarrationManifest();
          const { timings, durationInFrames } = buildTimeline(manifest, FPS);
          return { durationInFrames, props: { ...props, timings } };
        }}
      />
    </>
  );
}
