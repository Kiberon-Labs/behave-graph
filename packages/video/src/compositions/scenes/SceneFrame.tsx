// Shared per-scene chrome: fade in/out at the scene boundaries and an optional
// lower-third caption. Wraps every scene so cuts between narration lines are soft.
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../../theme';

const FADE_FRAMES = 12;

export function SceneFrame({
  durationInFrames,
  caption,
  children
}: {
  durationInFrames: number;
  caption?: string;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [
      0,
      FADE_FRAMES,
      Math.max(FADE_FRAMES + 1, durationInFrames - FADE_FRAMES),
      durationInFrames
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const captionIn = interpolate(
    frame,
    [FADE_FRAMES, FADE_FRAMES + 15],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    }
  );

  return (
    <AbsoluteFill
      style={{ background: theme.bg, opacity, fontFamily: theme.font }}
    >
      {children}
      {caption ? (
        <div
          style={{
            position: 'absolute',
            left: 64,
            bottom: 56,
            // Above the editor chrome  rc-dock splitters/panels carry their
            // own (high) z-indices and would otherwise cut through the caption.
            zIndex: 1000,
            opacity: captionIn,
            transform: `translateY(${(1 - captionIn) * 16}px)`,
            background: 'rgba(10, 9, 18, 0.88)',
            border: `1px solid ${theme.accent}`,
            borderLeft: `6px solid ${theme.accent}`,
            borderRadius: 8,
            padding: '14px 26px',
            color: theme.text,
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: 0.2
          }}
        >
          {caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
