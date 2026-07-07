// Title card in the Kiberon Labs house style (near-black, violet glow, faint
// grid). Two beats, mirroring the graph-grammar tour:
//
//   1. Brand: the official crystal mark + "Kiberon Labs" + what the company is,
//      centered  then the lockup docks to a compact top badge.
//   2. Product: the behave-graph title springs in over the animated motif  an
//      execution pulse travelling through three wired nodes (event → branch →
//      action), which is what a behavior graph *is*.
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';
import { theme } from '../../theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// The motif is a REAL branch: On Start feeds a Branch whose true/false outputs
// fan out to two different logs  the execution pulse alternates paths so the
// split in processing actually reads.
const NODE_H = 64;
const MOTIF_NODES = [
  { x: 60, y: 120, w: 150, label: 'On Start', in: false, outs: 1 },
  { x: 300, y: 120, w: 150, label: 'Branch', in: true, outs: 2 },
  { x: 560, y: 40, w: 190, label: 'Log: granted', in: true, outs: 0 },
  { x: 560, y: 200, w: 190, label: 'Log: denied', in: true, outs: 0 }
] as const;
const [ON_START, BRANCH, LOG_TRUE, LOG_FALSE] = MOTIF_NODES;
// Wire endpoints: On Start → Branch, then Branch's two out sockets → each log.
const WIRE_MAIN = {
  x1: ON_START.x + ON_START.w,
  y1: 152,
  x2: BRANCH.x,
  y2: 152
};
const OUT_TRUE = { x: BRANCH.x + BRANCH.w, y: 140 };
const OUT_FALSE = { x: BRANCH.x + BRANCH.w, y: 166 };
const IN_TRUE = { x: LOG_TRUE.x, y: LOG_TRUE.y + NODE_H / 2 };
const IN_FALSE = { x: LOG_FALSE.x, y: LOG_FALSE.y + NODE_H / 2 };

export function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (s: number) => s * fps;

  // --- beat 1: brand card, then dock to a top badge -------------------------
  const brandIn = spring({ frame, fps, config: { damping: 200 } });
  const dock = interpolate(frame, [t(4.2), t(5.4)], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic)
  });
  const brandY = interpolate(dock, [0, 1], [330, 34]);
  const brandScale = interpolate(dock, [0, 1], [1, 0.38]);
  const blurb = 1 - dock;

  // --- beat 2: product title + execution-pulse motif -------------------------
  const titleIn = spring({
    frame: Math.max(0, frame - t(5.2)),
    fps,
    config: { damping: 200 }
  });
  const taglineIn = interpolate(frame, [t(5.9), t(6.8)], [0, 1], clamp);
  const creditIn = interpolate(frame, [t(6.6), t(7.5)], [0, 1], clamp);
  const motifIn = interpolate(frame, [t(6.4), t(7.4)], [0, 1], clamp);

  // A pulse that repeatedly travels the exec wires (every 2.5s), alternating
  // between the branch's true and false paths on successive passes.
  const pulsePeriod = t(2.5);
  const sinceMotif = frame - t(7.4);
  const pulseT =
    motifIn > 0.9 && sinceMotif >= 0
      ? (sinceMotif % pulsePeriod) / pulsePeriod
      : 0;
  const takeTrue = Math.floor(Math.max(0, sinceMotif) / pulsePeriod) % 2 === 0;
  let pulse: { x: number; y: number } | null = null;
  if (pulseT > 0) {
    if (pulseT < 0.5) {
      const s = pulseT / 0.5;
      pulse = {
        x: WIRE_MAIN.x1 + (WIRE_MAIN.x2 - WIRE_MAIN.x1) * s,
        y: WIRE_MAIN.y1
      };
    } else {
      const s = (pulseT - 0.5) / 0.5;
      const from = takeTrue ? OUT_TRUE : OUT_FALSE;
      const to = takeTrue ? IN_TRUE : IN_FALSE;
      pulse = {
        x: from.x + (to.x - from.x) * s,
        y: from.y + (to.y - from.y) * s
      };
    }
  }

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
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 75% 65% at 50% 45%, transparent 55%, ${theme.bgDeep} 100%)`
        }}
      />

      {/* brand lockup: centered card that docks to a top badge */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: brandY,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          opacity: brandIn,
          transform: `scale(${brandScale})`,
          transformOrigin: 'top center'
        }}
      >
        <Img
          src={staticFile('brand/kiberon-mark.svg')}
          style={{
            width: 170,
            height: 170,
            filter: `drop-shadow(0 0 42px ${theme.violet}66)`
          }}
        />
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -1.5,
            textShadow: `0 0 46px ${theme.violet}80`
          }}
        >
          Kiberon Labs
        </div>
        <div
          style={{
            fontSize: 30,
            color: theme.muted,
            opacity: blurb,
            textAlign: 'center',
            lineHeight: 1.5
          }}
        >
          AI &amp; DevSecOps consulting  engineering-led, security-minded,
          outcome-driven.
          <br />
          The tools we build for our own work, given back to the community.
        </div>
      </div>

      {/* product title + motif */}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 60
        }}
      >
        <svg
          width={810}
          height={300}
          viewBox="0 0 810 300"
          style={{ opacity: motifIn }}
        >
          {/* exec wires: main, then the true/false fan-out (the taken path glows) */}
          <line
            x1={WIRE_MAIN.x1}
            y1={WIRE_MAIN.y1}
            x2={WIRE_MAIN.x2}
            y2={WIRE_MAIN.y2}
            stroke={theme.violet}
            strokeWidth={3}
          />
          <line
            x1={OUT_TRUE.x}
            y1={OUT_TRUE.y}
            x2={IN_TRUE.x}
            y2={IN_TRUE.y}
            stroke={pulseT >= 0.5 && takeTrue ? theme.accentSoft : theme.violet}
            strokeWidth={3}
          />
          <line
            x1={OUT_FALSE.x}
            y1={OUT_FALSE.y}
            x2={IN_FALSE.x}
            y2={IN_FALSE.y}
            stroke={
              pulseT >= 0.5 && !takeTrue ? theme.accentSoft : theme.violet
            }
            strokeWidth={3}
          />
          {/* travelling execution pulse */}
          {pulse ? (
            <circle cx={pulse.x} cy={pulse.y} r={8} fill={theme.accentSoft} />
          ) : null}
          {MOTIF_NODES.map((n) => (
            <g key={n.label}>
              <rect
                x={n.x}
                y={n.y}
                width={n.w}
                height={NODE_H}
                rx={12}
                fill={theme.panel}
                stroke={theme.violet}
                strokeWidth={2}
              />
              {/* exec sockets: in on the left, outs on the right */}
              {n.in ? (
                <circle
                  cx={n.x}
                  cy={n.y + NODE_H / 2}
                  r={6}
                  fill={theme.accentSoft}
                />
              ) : null}
              {n.outs === 1 ? (
                <circle
                  cx={n.x + n.w}
                  cy={n.y + NODE_H / 2}
                  r={6}
                  fill={theme.accentSoft}
                />
              ) : null}
              {n.outs === 2 ? (
                <>
                  <circle
                    cx={OUT_TRUE.x}
                    cy={OUT_TRUE.y}
                    r={6}
                    fill={theme.accentSoft}
                  />
                  <circle
                    cx={OUT_FALSE.x}
                    cy={OUT_FALSE.y}
                    r={6}
                    fill={theme.accentSoft}
                  />
                  <text
                    x={OUT_TRUE.x - 14}
                    y={OUT_TRUE.y + 5}
                    fill={theme.muted}
                    fontSize={15}
                    fontFamily={theme.font}
                  >
                    T
                  </text>
                  <text
                    x={OUT_FALSE.x - 14}
                    y={OUT_FALSE.y + 5}
                    fill={theme.muted}
                    fontSize={15}
                    fontFamily={theme.font}
                  >
                    F
                  </text>
                </>
              ) : null}
              <text
                x={n.x + n.w / 2}
                y={n.y + NODE_H / 2 + 8}
                textAnchor="middle"
                fill={theme.text}
                fontSize={24}
                fontWeight={600}
                fontFamily={theme.font}
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>
        <div
          style={{
            fontSize: 110,
            fontWeight: 800,
            letterSpacing: -2,
            transform: `scale(${0.9 + titleIn * 0.1})`,
            opacity: titleIn,
            textShadow: `0 0 60px ${theme.violet}59`
          }}
        >
          behave<span style={{ color: theme.accent }}>-</span>graph
        </div>
        <div
          style={{
            fontSize: 38,
            color: theme.muted,
            marginTop: 18,
            opacity: taglineIn
          }}
        >
          Visual scripting for the web  engine, editor, and everything between
        </div>
        <div
          style={{
            fontSize: 24,
            color: theme.muted,
            marginTop: 26,
            opacity: creditIn * 0.85
          }}
        >
          Free &amp; open source · a Kiberon Labs project
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
