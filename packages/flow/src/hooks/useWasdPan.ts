import { useCallback, useEffect, useRef } from 'react';
import type { ReactFlowInstance } from 'reactflow';

export type UseWasdPanOptions = {
  getReactFlowInstance: () => ReactFlowInstance | undefined;
  speed?: number;
  speedWithShift?: number;
  dtCapSeconds?: number;
  enabled?: boolean;
};

const isEditableElement = (element: HTMLElement): boolean => {
  const tag = element.tagName?.toLowerCase();
  // Contenteditable surfaces (e.g. the notes plugin's prosemirror editor) are
  // divs, so checking the tag alone is not enough — WASD must type, not pan.
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    element.isContentEditable
  );
};

export const isEventFromEditable = (event: KeyboardEvent) => {
  // Events from inside a web component are retargeted: at the window listener
  // `event.target` is the custom-element host (e.g. the conversation panel's
  // <vscode-textfield>), not the <input> in its shadow DOM. composedPath()
  // exposes the real target chain, so walk it and check every element.
  const path =
    typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (path.length > 0) {
    return path.some(
      (node) => node instanceof HTMLElement && isEditableElement(node)
    );
  }
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  return isEditableElement(target);
};

export const useWasdPan = ({
  getReactFlowInstance,
  speed = 650,
  speedWithShift = 1400,
  dtCapSeconds = 0.05,
  enabled = true
}: UseWasdPanOptions) => {
  const wasdRef = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false
  });
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  const cancelPanLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameRef.current = null;
  }, []);

  const startPanLoop = useCallback(() => {
    if (rafRef.current != null) return;

    const tick = (now: number) => {
      const last = lastFrameRef.current;
      lastFrameRef.current = now;
      const dtMs = last == null ? 0 : now - last;
      const dt = Math.min(dtCapSeconds, dtMs / 1000);

      const state = wasdRef.current;
      const any = state.w || state.a || state.s || state.d;
      const reactFlowInstance = getReactFlowInstance();

      if (!enabled || !any) {
        cancelPanLoop();
        return;
      }

      // The reactflow ref can be temporarily unavailable during re-mounts.
      // If we cancel here while the user is still holding a key, we might never
      // restart because we ignore keydown repeats.
      if (!reactFlowInstance) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const appliedSpeed = state.shift ? speedWithShift : speed;
      const step = appliedSpeed * dt;

      let dx = 0;
      let dy = 0;
      if (state.a) dx += step;
      if (state.d) dx -= step;
      if (state.w) dy += step;
      if (state.s) dy -= step;

      if (dx !== 0 || dy !== 0) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({
          ...viewport,
          x: viewport.x + dx,
          y: viewport.y + dy
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [
    cancelPanLoop,
    dtCapSeconds,
    enabled,
    getReactFlowInstance,
    speed,
    speedWithShift
  ]);

  useEffect(() => {
    if (!enabled) {
      wasdRef.current = {
        w: false,
        a: false,
        s: false,
        d: false,
        shift: false
      };
      cancelPanLoop();
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEventFromEditable(event)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key?.toLowerCase();
      if (
        key !== 'w' &&
        key !== 'a' &&
        key !== 's' &&
        key !== 'd' &&
        key !== 'shift'
      ) {
        return;
      }

      if (key === 'shift') {
        wasdRef.current.shift = true;
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (key === 'w') wasdRef.current.w = true;
      if (key === 'a') wasdRef.current.a = true;
      if (key === 's') wasdRef.current.s = true;
      if (key === 'd') wasdRef.current.d = true;

      startPanLoop();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key?.toLowerCase();
      if (key === 'shift') {
        wasdRef.current.shift = false;
        return;
      }

      if (key === 'w') wasdRef.current.w = false;
      if (key === 'a') wasdRef.current.a = false;
      if (key === 's') wasdRef.current.s = false;
      if (key === 'd') wasdRef.current.d = false;

      const state = wasdRef.current;
      if (!(state.w || state.a || state.s || state.d)) {
        cancelPanLoop();
      }
    };

    const onBlur = () => {
      wasdRef.current = {
        w: false,
        a: false,
        s: false,
        d: false,
        shift: false
      };
      cancelPanLoop();
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown, {
        capture: true
      });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', onBlur);
      cancelPanLoop();
    };
  }, [cancelPanLoop, enabled, startPanLoop]);
};
