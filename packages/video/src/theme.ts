// Brand tokens for the video overlays (titles, captions, outro)  the same
// "purplish Linear" Kiberon Labs look established in the graph-grammar tour
// video. The editor itself is themed separately via `data-flow-theme="kiberon"`.
export const theme = {
  bg: '#0d1117',
  bgDeep: '#0a0912',
  panel: '#161b22',
  text: '#e6edf3',
  muted: '#9198a1',
  accent: '#8b5cf6',
  accentSoft: '#c4b5fd',
  good: '#2f9e44',
  /** Kiberon Labs DS violet (canonical --primary)  brand glow & grid. */
  violet: '#7b5dcd',
  font: "'Geist Variable', 'Geist', 'Inter', 'Segoe UI', system-ui, sans-serif",
  mono: "'Geist Mono Variable', 'Geist Mono', 'JetBrains Mono', Consolas, monospace"
} as const;
