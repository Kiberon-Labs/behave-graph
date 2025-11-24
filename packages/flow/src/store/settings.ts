import { create } from 'zustand';

export const EDGE_TYPE = {
  bezier: 'Bezier',
  smoothStep: 'Smooth step',
  straight: 'Straight',
  simpleBezier: 'Simple Bezier'
} as const;

export type EdgeType = (typeof EDGE_TYPE)[keyof typeof EDGE_TYPE];

export const LAYOUT_TYPE = {
  dagre: 'Dagre',
  elkForce: 'Elk - Force',
  elkRect: 'Elk - Rect',
  elkLayered: 'Elk - Layered',
  elkStress: 'Elk - Stress'
} as const;

export type LayoutType = (typeof LAYOUT_TYPE)[keyof typeof LAYOUT_TYPE];

export type SystemSettingsStore = {
  debugMode: boolean;
  showTimings: boolean;
  showMinimap: boolean;
  showGrid: boolean;
  showSearch: boolean;
  edgeType: EdgeType;
  layoutType: LayoutType;
  delayedUpdate: boolean;
  inlineTypes: boolean;
  inlineValues: boolean;
  connectOnClick: boolean;
  snapGrid: boolean;
  setDebugMode: (debugMode: boolean) => void;
  setShowTimings: (showTimings: boolean) => void;
  setShowMinimap: (showMinimap: boolean) => void;
  setShowGrid: (showGrid: boolean) => void;
  setShowSearch: (showSearch: boolean) => void;
  setEdgeType: (edgeType: EdgeType) => void;
  setLayoutType: (layoutType: LayoutType) => void;
  setDelayedUpdate: (delayedUpdate: boolean) => void;
  setInlineTypes: (inlineTypes: boolean) => void;
  setInlineValues: (inlineValues: boolean) => void;
  setConnectOnClick: (connectOnClick: boolean) => void;
  setSnapGrid: (snapGrid: boolean) => void;
};

export const systemSettingsFactory = () =>
  create<SystemSettingsStore>((set) => ({
    edgeType: EDGE_TYPE.bezier,
    layoutType: LAYOUT_TYPE.dagre,
    debugMode: false,
    showTimings: false,
    showMinimap: false,
    showGrid: true,
    showSearch: false,
    /**
     * Whether to delay the update of a node when a value is changed
     */
    delayedUpdate: false,
    /**
     * Whether to show the types inline with the nodes
     */
    inlineTypes: false,
    /**
     * Whether to show the values inline with the nodes
     */
    inlineValues: false,
    connectOnClick: true,
    snapGrid: false,

    setEdgeType: (edgeType: EdgeType) => set(() => ({ edgeType })),
    setLayoutType: (layoutType: LayoutType) => set(() => ({ layoutType })),
    setDebugMode: (debugMode: boolean) => set(() => ({ debugMode })),
    setShowTimings: (showTimings: boolean) => set(() => ({ showTimings })),
    setShowMinimap: (showMinimap: boolean) => set(() => ({ showMinimap })),
    setShowGrid: (showGrid: boolean) => set(() => ({ showGrid })),
    setShowSearch: (showSearch: boolean) => set(() => ({ showSearch })),
    setDelayedUpdate: (delayedUpdate: boolean) =>
      set(() => ({ delayedUpdate })),
    setInlineTypes: (inlineTypes: boolean) => set(() => ({ inlineTypes })),
    setInlineValues: (inlineValues: boolean) => set(() => ({ inlineValues })),
    setConnectOnClick: (connectOnClick: boolean) =>
      set(() => ({ connectOnClick })),
    setSnapGrid: (snapGrid: boolean) => set(() => ({ snapGrid }))
  }));
