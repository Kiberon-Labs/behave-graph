// Call to action: install command, docs site, repo, attribution.
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';
import { theme } from '../../theme';

export function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = (delaySeconds: number) =>
    interpolate(
      frame,
      [fps * delaySeconds, fps * (delaySeconds + 0.6)],
      [0, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp'
      }
    );

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.text,
        gap: 34,
        fontFamily: theme.font,
        backgroundColor: theme.bgDeep,
        backgroundImage: `radial-gradient(ellipse 62% 46% at 50% -10%, ${theme.violet}4d, transparent)`
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          opacity: fadeIn(0)
        }}
      >
        <Img
          src={staticFile('brand/kiberon-mark.svg')}
          style={{
            width: 84,
            height: 84,
            filter: `drop-shadow(0 0 30px ${theme.violet}66)`
          }}
        />
        <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -2 }}>
          behave<span style={{ color: theme.accent }}>-</span>graph
        </div>
      </div>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 40,
          background: theme.panel,
          border: `1px solid ${theme.accent}`,
          borderRadius: 10,
          padding: '18px 40px',
          opacity: fadeIn(0.8)
        }}
      >
        <span style={{ color: theme.muted }}>$ </span>npm install
        @kiberon-labs/behave-graph
      </div>
      <div
        style={{ fontSize: 34, color: theme.accentSoft, opacity: fadeIn(1.6) }}
      >
        behave-graph.kiberonlabs.com
      </div>
      <div
        style={{
          fontSize: 26,
          color: theme.muted,
          marginTop: 24,
          opacity: fadeIn(2.2)
        }}
      >
        Open source · a Kiberon Labs project ·
        github.com/Kiberon-Labs/behave-graph
      </div>
    </AbsoluteFill>
  );
}
