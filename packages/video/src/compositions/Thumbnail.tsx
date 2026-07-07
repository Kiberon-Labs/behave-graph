// The video thumbnail, as a Remotion <Still>: brand backdrop + title + exec-flow
// motif on the left, the REAL Flow editor (Sequence example, Kiberon theme) as
// an angled glowing card on the right.
//
//   corepack pnpm --filter @kiberon-labs/behave-graph-video thumbnail
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { theme } from '../theme';
import { EditorScene } from './scenes/EditorScene';
import type { EditorSceneSpec } from '../narration/script';

const CARD_SCENE: EditorSceneSpec = {
  id: 'thumbnail-card',
  kind: 'editor',
  graphKey: 'gameLoot',
  caption: '',
  text: '',
  fallbackSeconds: 1
};

function FlowMotif() {
  // A real branch: On Start → Branch, whose true/false outputs fan out to two
  // different logs  the split in processing is the point of the motif.
  const h = 52;
  const nodes = [
    { x: 10, y: 64, w: 130, label: 'On Start' },
    { x: 200, y: 64, w: 130, label: 'Branch' },
    { x: 400, y: 8, w: 160, label: 'Log: granted' },
    { x: 400, y: 120, w: 160, label: 'Log: denied' }
  ];
  const [onStart, branch, logTrue, logFalse] = nodes;
  return (
    <svg width={580} height={180} viewBox="0 0 580 180">
      <line
        x1={onStart.x + onStart.w}
        y1={onStart.y + h / 2}
        x2={branch.x}
        y2={branch.y + h / 2}
        stroke={theme.violet}
        strokeWidth={3}
      />
      <line
        x1={branch.x + branch.w}
        y1={branch.y + 16}
        x2={logTrue.x}
        y2={logTrue.y + h / 2}
        stroke={theme.violet}
        strokeWidth={3}
      />
      <line
        x1={branch.x + branch.w}
        y1={branch.y + 36}
        x2={logFalse.x}
        y2={logFalse.y + h / 2}
        stroke={theme.violet}
        strokeWidth={3}
      />
      {nodes.map((n) => (
        <g key={n.label}>
          <rect
            x={n.x}
            y={n.y}
            width={n.w}
            height={h}
            rx={10}
            fill={theme.panel}
            stroke={theme.violet}
            strokeWidth={2}
          />
          <text
            x={n.x + n.w / 2}
            y={n.y + h / 2 + 7}
            textAnchor="middle"
            fill={theme.text}
            fontSize={20}
            fontWeight={600}
            fontFamily={theme.font}
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Thumbnail() {
  return (
    <AbsoluteFill
      style={{
        color: theme.text,
        fontFamily: theme.font,
        backgroundColor: theme.bgDeep,
        backgroundImage: [
          `radial-gradient(ellipse 62% 46% at 50% -10%, ${theme.violet}4d, transparent)`,
          `linear-gradient(${theme.violet}12 1px, transparent 1px)`,
          `linear-gradient(90deg, ${theme.violet}12 1px, transparent 1px)`
        ].join(', '),
        backgroundSize: 'auto, 72px 72px, 72px 72px'
      }}
    >
      {/* the real editor, angled card bleeding off the right edge */}
      <div
        style={{
          position: 'absolute',
          right: -170,
          top: 120,
          width: 1250,
          height: 850,
          transform: 'rotate(2.5deg)',
          borderRadius: 18,
          overflow: 'hidden',
          border: `1px solid ${theme.violet}66`,
          boxShadow: `0 30px 90px rgba(0, 0, 0, 0.65), 0 0 90px ${theme.violet}40`
        }}
      >
        <EditorScene scene={CARD_SCENE} durationInFrames={1} />
      </div>

      {/* scrim so the text side stays readable over the card */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, ${theme.bgDeep} 30%, rgba(10, 9, 18, 0.55) 55%, transparent 72%)`
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 34,
          maxWidth: 900
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Img
            src={staticFile('brand/kiberon-mark.svg')}
            style={{
              width: 62,
              height: 62,
              filter: `drop-shadow(0 0 22px ${theme.violet}66)`
            }}
          />
          <span
            style={{
              fontSize: 34,
              fontWeight: 600,
              color: theme.muted,
              letterSpacing: 0.5
            }}
          >
            Kiberon Labs
          </span>
        </div>
        <div
          style={{
            fontSize: 128,
            fontWeight: 800,
            letterSpacing: -3,
            lineHeight: 1.02,
            textShadow: `0 0 70px ${theme.violet}66`
          }}
        >
          behave<span style={{ color: theme.accent }}>-</span>graph
        </div>
        <div style={{ fontSize: 44, color: theme.text, fontWeight: 500 }}>
          Visual scripting for the web
          <br />
          engine, editor, and everything between
        </div>
        <FlowMotif />
        <div
          style={{
            alignSelf: 'flex-start',
            fontSize: 26,
            color: theme.accentSoft,
            border: `1px solid ${theme.violet}55`,
            borderRadius: 999,
            padding: '10px 26px',
            background: `${theme.violet}1a`
          }}
        >
          TypeScript · sandboxed · suspendable · open source
        </div>
      </div>
    </AbsoluteFill>
  );
}
