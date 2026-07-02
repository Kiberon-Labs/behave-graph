import type { Engine, INode } from '@kiberon-labs/behave-graph';
import { create } from 'zustand';
import type { GraphSession } from '@/system/graphSession';

export type TraceSpan = {
  id: number;
  nodeId: string;
  name: string;
  start: number;
  end: number; // NaN while open
  lane: number;
};

export type SpanCollector = {
  capacity: number;
  spans: TraceSpan[];
  writeIndex: number;
  size: number;
  nextId: number;
  openByNodeId: Map<string, number[]>;
  laneOpen: boolean[];
};

const createCollector = (capacity: number): SpanCollector => ({
  capacity,
  spans: Array.from({ length: capacity }) as TraceSpan[],
  writeIndex: 0,
  size: 0,
  nextId: 1,
  openByNodeId: new Map(),
  laneOpen: []
});

const getNodeName = (node: INode): string =>
  node.label ?? node.description?.typeName ?? node.id;

const allocateLane = (collector: SpanCollector): number => {
  for (let i = 0; i < collector.laneOpen.length; i++) {
    if (!collector.laneOpen[i]) {
      collector.laneOpen[i] = true;
      return i;
    }
  }
  collector.laneOpen.push(true);
  return collector.laneOpen.length - 1;
};

const removeIndexFromArrayInPlace = (arr: number[], index: number): void => {
  const idx = arr.indexOf(index);
  if (idx >= 0) arr.splice(idx, 1);
};

const evictIfNeeded = (collector: SpanCollector, now: number): void => {
  const i = collector.writeIndex;
  const existing = collector.spans[i];
  if (!existing) return;

  // If we are about to overwrite an open span, force-close it.
  if (Number.isNaN(existing.end)) {
    existing.end = now;
    collector.laneOpen[existing.lane] = false;
    const stack = collector.openByNodeId.get(existing.nodeId);
    if (stack) {
      removeIndexFromArrayInPlace(stack, i);
      if (stack.length === 0) collector.openByNodeId.delete(existing.nodeId);
    }
  }
};

export type TraceStore = {
  version: number;
  collector: SpanCollector;
  clear: () => void;
  connectEngine: (engine?: Engine) => void;
  recordNodeStart: (node: INode, startTime?: number) => void;
  recordNodeEnd: (node: INode, endTime?: number) => void;
  addSpan: (span: Omit<TraceSpan, 'id' | 'lane'> & { lane?: number }) => void;
  updateSpan: (nodeId: string, updates: Partial<TraceSpan>) => void;
};

export const traceStoreFactory = (_: GraphSession) => {
  let connectedEngine: Engine | undefined;
  let onStart: ((node: INode) => void) | undefined;
  let onEnd: ((node: INode) => void) | undefined;

  let rafHandle: number | undefined;
  let dirty = false;

  const scheduleFlush = (
    set: (fn: (s: TraceStore) => Partial<TraceStore>) => void
  ) => {
    dirty = true;
    if (rafHandle !== undefined) return;
    rafHandle = window.requestAnimationFrame(() => {
      rafHandle = undefined;
      if (!dirty) return;
      dirty = false;
      set((s) => ({ version: s.version + 1 }));
    });
  };

  const store = create<TraceStore>((set, get) => ({
    version: 0,
    collector: createCollector(10_000),

    clear: () => {
      const c = get().collector;
      c.spans = Array.from({ length: c.capacity }) as TraceSpan[];
      c.writeIndex = 0;
      c.size = 0;
      c.nextId = 1;
      c.openByNodeId.clear();
      c.laneOpen = [];
      set((s) => ({ version: s.version + 1 }));
    },

    connectEngine: (engine?: Engine) => {
      if (connectedEngine && onStart && onEnd) {
        connectedEngine.onNodeExecutionStart.removeListener(onStart);
        connectedEngine.onNodeExecutionEnd.removeListener(onEnd);
      }

      connectedEngine = engine;

      if (!engine) return;

      onStart = (node) => {
        get().recordNodeStart(node);
      };

      onEnd = (node) => {
        get().recordNodeEnd(node);
      };

      engine.onNodeExecutionStart.addListener(onStart);
      engine.onNodeExecutionEnd.addListener(onEnd);
    },

    recordNodeStart: (node, startTime) => {
      const c = get().collector;
      const now = startTime ?? performance.now();

      evictIfNeeded(c, now);

      const lane = allocateLane(c);
      const index = c.writeIndex;

      const span: TraceSpan = {
        id: c.nextId++,
        nodeId: node.id,
        name: getNodeName(node),
        start: now,
        end: Number.NaN,
        lane
      };

      c.spans[index] = span;

      const stack = c.openByNodeId.get(node.id) ?? [];
      stack.push(index);
      c.openByNodeId.set(node.id, stack);

      c.writeIndex = (c.writeIndex + 1) % c.capacity;
      c.size = Math.min(c.capacity, c.size + 1);

      scheduleFlush(set);
    },

    recordNodeEnd: (node, endTime) => {
      const c = get().collector;
      const stack = c.openByNodeId.get(node.id);
      if (!stack || stack.length === 0) return;

      const index = stack.pop()!;
      if (stack.length === 0) c.openByNodeId.delete(node.id);

      const span = c.spans[index];
      if (!span || !Number.isNaN(span.end)) return;

      span.end = endTime ?? performance.now();
      c.laneOpen[span.lane] = false;

      scheduleFlush(set);
    },

    addSpan: (spanData) => {
      const c = get().collector;

      // Evict if needed
      if (c.size >= c.capacity) {
        evictIfNeeded(c, spanData.start);
      }

      // Allocate lane if not provided
      const lane = spanData.lane ?? allocateLane(c);
      const index = c.writeIndex;

      const span: TraceSpan = {
        id: c.nextId++,
        ...spanData,
        lane
      };

      c.spans[index] = span;

      const stack = c.openByNodeId.get(span.nodeId) ?? [];
      stack.push(index);
      c.openByNodeId.set(span.nodeId, stack);

      c.writeIndex = (c.writeIndex + 1) % c.capacity;
      c.size = Math.min(c.capacity, c.size + 1);

      scheduleFlush(set);
    },

    updateSpan: (nodeId, updates) => {
      const c = get().collector;
      const stack = c.openByNodeId.get(nodeId);
      if (!stack || stack.length === 0) return;

      const index = stack[stack.length - 1]!;
      const span = c.spans[index];
      if (!span) return;

      Object.assign(span, updates);

      if (updates.end !== undefined && !Number.isNaN(updates.end)) {
        stack.pop();
        if (stack.length === 0) c.openByNodeId.delete(nodeId);
        if (span.lane !== undefined) {
          c.laneOpen[span.lane] = false;
        }
      }

      scheduleFlush(set);
    }
  }));

  return store;
};
