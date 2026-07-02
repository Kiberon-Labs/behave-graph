import React, { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { System } from './system';
import type { GraphSession } from './graphSession';

// ---------------------------------------------------------------------------
// Editor system context
// ---------------------------------------------------------------------------

export const SystemContext = createContext<System | undefined>(undefined);

export type SystemProviderProps = {
  children: ReactNode;
  value: System;
};

/**
 * Provides the editor-level {@link System} to the React tree.
 */
export function SystemProvider({ children, value }: SystemProviderProps) {
  return <SystemContext value={value}>{children}</SystemContext>;
}

/** Alias for {@link SystemProvider} expressing its editor-level role. */
export const EditorProvider = SystemProvider;

/**
 * Access the editor-level {@link System}.
 */
export function useSystem(): System {
  const context = useContext(SystemContext);

  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider');
  }

  return context;
}

/** Alias for {@link useSystem}. */
export const useEditor = useSystem;

// ---------------------------------------------------------------------------
// Per-graph session context
// ---------------------------------------------------------------------------

const GraphContext = createContext<GraphSession | undefined>(undefined);

export type GraphProviderProps = {
  children: ReactNode;
  value: GraphSession;
};

/**
 * Provides a single {@link GraphSession} to the subtree rendered inside a graph
 * tab. Components within use {@link useGraph} to read per-graph state bound to
 * their own tab, regardless of which tab is currently focused.
 */
export function GraphProvider({ children, value }: GraphProviderProps) {
  return <GraphContext value={value}>{children}</GraphContext>;
}

/**
 * Access the {@link GraphSession} of the surrounding graph tab.
 */
export function useGraph(): GraphSession {
  const context = useContext(GraphContext);

  if (context === undefined) {
    throw new Error('useGraph must be used within a GraphProvider');
  }

  return context;
}

/**
 * Access the currently focused {@link GraphSession}, or undefined when no graph
 * is open. Subscribes to the editor's active-graph store, so panels rendered
 * outside of a graph tab re-render when the focused graph changes.
 */
export function useActiveGraph(): GraphSession | undefined {
  const editor = useSystem();
  return useStore(editor.activeGraph, (s) =>
    s.activeGraphId ? s.sessions[s.activeGraphId] : undefined
  );
}
