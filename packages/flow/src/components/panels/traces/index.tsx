import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useSystem } from '@/system';
import type { TraceSpan } from '@/store/traces';
import { VscodeButton, VscodeDivider } from '@vscode-elements/react-elements';
import styles from './index.module.css';
import { BasePanel } from '../base';
import type { HoverInfo, ViewState } from './types';
import { clamp } from './utils';
import { useDerivedSpans } from './useDerivedSpans';
import { TracesHeader } from './TracesHeader';
import { TimeGrid } from './TimeGrid';
import { GridLines } from './GridLines';
import { TraceLane } from './TraceLane';
import { TraceTooltip } from './TraceTooltip';

const PADDING = 8;

export function TracesPanel() {
  const system = useSystem();
  const version = useStore(system.traceStore, (s) => s.version);
  const clear = useStore(system.traceStore, (s) => s.clear);
  const collector = system.traceStore.getState().collector;

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [windowMs, setWindowMs] = useState<number>(5000);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [view, setView] = useState<ViewState>(() => ({
    start: 0,
    range: 5000,
    follow: true
  }));

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    dragging: boolean;
    startClientX: number;
    startViewStart: number;
    startViewRange: number;
  }>({
    dragging: false,
    startClientX: 0,
    startViewStart: 0,
    startViewRange: 0
  });

  const laneHeight = expanded ? 32 : 16;

  const derived = useDerivedSpans(collector, version, windowMs, view);

  // Keep the view aligned to the selector when following.
  useEffect(() => {
    if (derived.size <= 0 || !view.follow) return;
    const desiredRange = windowMs <= 0 ? derived.range : Math.max(1, windowMs);
    const range = clamp(desiredRange, 1, derived.range);
    const start = clamp(
      derived.maxEnd - range,
      derived.minStart,
      derived.maxEnd - range
    );
    setView((v) =>
      v.range === range && v.start === start ? v : { ...v, range, start }
    );
  }, [
    derived.size,
    derived.range,
    derived.minStart,
    derived.maxEnd,
    windowMs,
    view.follow
  ]);

  const clampViewStart = useCallback(
    (start: number, range: number) =>
      clamp(start, derived.minStart, derived.maxEnd - range),
    [derived.minStart, derived.maxEnd]
  );

  // ---------- Event delegation for span hover / click ----------

  const findSpanElement = (target: EventTarget | null): HTMLElement | null => {
    let el = target as HTMLElement | null;
    while (el && !el.hasAttribute('data-trace-span')) {
      if (el === scrollRef.current) return null;
      el = el.parentElement;
    }
    return el;
  };

  const handleDelegatedMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const spanEl = findSpanElement(e.target);
      if (!spanEl) return;
      const name = spanEl.getAttribute('data-span-name') ?? '';
      const nodeId = spanEl.getAttribute('data-node-id') ?? '';
      const durationMs = Number(
        spanEl.getAttribute('data-span-duration') ?? '0'
      );
      const id = Number(spanEl.getAttribute('data-span-id') ?? '0');
      setHover({
        span: { id, nodeId, name } as TraceSpan,
        durationMs
      });
    },
    []
  );

  const handleDelegatedMouseOut = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const spanEl = findSpanElement(e.relatedTarget);
      if (!spanEl) setHover(null);
    },
    []
  );

  const handleDelegatedClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const spanEl = findSpanElement(e.target);
      if (!spanEl) return;
      const nodeId = spanEl.getAttribute('data-node-id');
      if (!nodeId) return;
      system.actionStore.getState().actions.focusNode(nodeId);
      system.selectionStore.getState().setSelectedNodeId(nodeId);
    },
    [system.actionStore, system.selectionStore]
  );

  // ---------- Wheel zoom / pan ----------

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (derived.size === 0) return;

      const el = scrollRef.current;
      if (el) {
        const canScroll = el.scrollHeight > el.clientHeight;
        if (canScroll) {
          const atTop = el.scrollTop <= 0;
          const atBottom =
            el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          const wouldScroll =
            (e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop);
          if (wouldScroll && !e.shiftKey) return;
        }
      }

      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width);
      const t =
        derived.viewStart + (x / Math.max(1, rect.width)) * derived.viewRange;

      if (e.shiftKey) {
        const deltaT = (e.deltaY / Math.max(1, rect.width)) * derived.viewRange;
        setView((v) => {
          const start = clampViewStart(v.start + deltaT, v.range);
          return { ...v, start, follow: false };
        });
        e.preventDefault();
        return;
      }

      const zoomFactor = Math.exp(e.deltaY * 0.0015);
      setView((v) => {
        const nextRange = clamp(v.range * zoomFactor, 1, derived.range);
        const k = x / Math.max(1, rect.width);
        const nextStart = clampViewStart(t - k * nextRange, nextRange);
        return {
          ...v,
          range: nextRange,
          start: nextStart,
          follow: false
        };
      });
      e.preventDefault();
    },
    [
      derived.size,
      derived.viewStart,
      derived.viewRange,
      derived.range,
      clampViewStart
    ]
  );

  // ---------- Drag pan ----------

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (derived.size === 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-trace-span]')) return;
      dragRef.current.dragging = true;
      dragRef.current.startClientX = e.clientX;
      dragRef.current.startViewStart = derived.viewStart;
      dragRef.current.startViewRange = derived.viewRange;
      setView((v) => ({ ...v, follow: false }));
    },
    [derived.size, derived.viewStart, derived.viewRange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragRef.current.dragging) return;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const dx = e.clientX - dragRef.current.startClientX;
      const deltaT =
        (-dx / Math.max(1, rect.width)) * dragRef.current.startViewRange;
      const nextStart = clampViewStart(
        dragRef.current.startViewStart + deltaT,
        dragRef.current.startViewRange
      );
      setView((v) => ({ ...v, start: nextStart }));
    },
    [clampViewStart]
  );

  const stopDrag = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  // ---------- Header callbacks ----------

  const handleWindowChange = useCallback((ms: number) => {
    setWindowMs(ms);
    setView((v) => ({ ...v, follow: true }));
  }, []);

  const handleToggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleClear = useCallback(() => clear(), [clear]);

  return (
    <BasePanel>
      <TracesHeader
        size={derived.size}
        lanes={derived.lanes}
        windowMs={windowMs}
        expanded={expanded}
        onWindowChange={handleWindowChange}
        onToggleExpanded={handleToggleExpanded}
      />
      <VscodeDivider />

      {derived.size === 0 ? (
        <div className={styles.empty}>
          No spans captured yet. Run/trigger the graph to record node execution.
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={styles.scroll}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onMouseOver={handleDelegatedMouseOver}
          onMouseOut={handleDelegatedMouseOut}
          onClick={handleDelegatedClick}
          style={{
            cursor: dragRef.current.dragging ? 'grabbing' : 'grab'
          }}
        >
          <TimeGrid ticks={derived.ticks} padding={PADDING} />

          <div
            className={styles.lanes}
            style={{ padding: PADDING, position: 'relative' }}
          >
            <GridLines ticks={derived.ticks} padding={PADDING} />

            {derived.laneData.map((ld, lane) => (
              <TraceLane
                key={lane}
                laneData={ld}
                laneHeight={laneHeight}
                expanded={expanded}
                hoveredSpanId={hover?.span?.id}
              />
            ))}
          </div>

          <TraceTooltip hover={hover} />
        </div>
      )}

      <VscodeButton onClick={handleClear} type="button">
        Clear
      </VscodeButton>
    </BasePanel>
  );
}
