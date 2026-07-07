// The full marketing tour: one <Sequence> per narration scene, each carrying its
// generated voice line (when `pnpm voice` has run) and the matching visual.
// Scene boundaries come from the timing manifest via calculateMetadata in Root.
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { SCENES, type NarrationScene } from '../narration/script';
import type { SceneTiming } from '../narration/timeline';
import { theme } from '../theme';
import { EditorScene } from './scenes/EditorScene';
import { Intro } from './scenes/Intro';
import { Outro } from './scenes/Outro';
import { SceneFrame } from './scenes/SceneFrame';

// A type alias (not an interface) so it satisfies Remotion's
// Record<string, unknown> props constraint.
export type DemoTourProps = {
  timings: SceneTiming[];
};

function SceneView({
  scene,
  durationInFrames
}: {
  scene: NarrationScene;
  durationInFrames: number;
}) {
  switch (scene.kind) {
    case 'intro':
      return <Intro />;
    case 'outro':
      return <Outro />;
    case 'editor':
      return <EditorScene scene={scene} durationInFrames={durationInFrames} />;
  }
}

export function DemoTour({ timings }: DemoTourProps) {
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {SCENES.map((scene) => {
        const timing = timings.find((t) => t.id === scene.id);
        if (!timing) return null;
        return (
          <Sequence
            key={scene.id}
            name={scene.id}
            from={timing.from}
            durationInFrames={timing.durationInFrames}
          >
            {timing.audioFile ? (
              <Audio src={staticFile(timing.audioFile)} />
            ) : null}
            <SceneFrame
              durationInFrames={timing.durationInFrames}
              caption={scene.kind === 'editor' ? scene.caption : undefined}
            >
              <SceneView
                scene={scene}
                durationInFrames={timing.durationInFrames}
              />
            </SceneFrame>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
