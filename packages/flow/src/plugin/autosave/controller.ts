import { createStore, type StoreApi } from 'zustand/vanilla';
import { v4 as uuidv4 } from 'uuid';
import type { System, SettingsStorage } from '@/system/system';
import type { GraphSession } from '@/system/graphSession';
import { buildUIGraphJSON } from '@/transformers/Uigraph';
import type { UIGraphJSON } from '@/types/graph';
import { BackupStorage, type BackupSnapshot } from './storage';
import {
  AUTOSAVE_ENABLED,
  AUTOSAVE_INTERVAL_SECONDS,
  AUTOSAVE_MAX_COPIES,
  AUTOSAVE_DEFAULTS,
  MIN_INTERVAL_SECONDS
} from './settings';

/**
 * Wait for a graph to be untouched for this long before snapshotting it. A drag
 * or a multi-store edit produces a burst of store updates; requiring a quiet
 * window means we capture the settled result rather than a half-applied frame.
 */
const QUIESCE_MS = 800;

/** Reactive slice the backup panel subscribes to. */
export type BackupControllerStore = {
  /** All snapshots across every graph, newest first. */
  snapshots: BackupSnapshot[];
  /** Whether the timer is currently running. */
  running: boolean;
  /** Epoch ms of the last successful capture, or null. */
  lastBackupAt: number | null;
};

/** Per-open-session bookkeeping used to decide when a snapshot is worthwhile. */
type SessionWatch = {
  /** Changed since the last successful capture. */
  dirty: boolean;
  /** Epoch ms of the most recent store change (for the quiescence window). */
  lastChange: number;
  /** Serialized form of the last captured graph, to skip exact duplicates. */
  lastCapturedJson: string;
  /** Removes the node/edge store subscriptions. */
  unsubscribe: () => void;
};

/**
 * Every edge must point at nodes that exist. A snapshot taken mid-way through a
 * load or a bulk mutation can have edges referencing not-yet-added (or
 * already-removed) nodes; refusing to persist such a document is the concrete
 * meaning of "do not take a copy during an inconsistent state".
 */
const isConsistent = (graph: UIGraphJSON): boolean => {
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return false;
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!node || typeof node.id !== 'string') return false;
    ids.add(node.id);
  }
  for (const edge of graph.edges) {
    if (!edge || !edge.source || !edge.target) return false;
    if (!ids.has(edge.source) || !ids.has(edge.target)) return false;
  }
  return true;
};

/**
 * Drives periodic, consistency-checked backups of every open graph into local
 * storage, and restores from them. Owned by the autosave plugin and exposed on
 * the editor as `system.backups` so panels and other plugins can drive it.
 *
 * Snapshots are only written when a graph has actually changed, has settled
 * (see {@link QUIESCE_MS}), is internally consistent, and is not empty , and
 * never while a caller has the controller suspended. Timer cadence, copy count
 * and the on/off switch are read live from the editor settings.
 */
export class BackupController {
  public readonly store: StoreApi<BackupControllerStore>;
  private readonly system: System;
  private readonly backups: BackupStorage;

  private timer: ReturnType<typeof setInterval> | undefined;
  /** Nesting counter: > 0 means "unsafe to snapshot right now". */
  private suspendDepth = 0;
  private readonly watches = new Map<string, SessionWatch>();

  private readonly disposers: Array<() => void> = [];

  constructor(system: System, storage?: SettingsStorage) {
    this.system = system;
    this.backups = new BackupStorage(storage);
    this.store = createStore<BackupControllerStore>(() => ({
      snapshots: this.backups.listAll(),
      running: false,
      lastBackupAt: null
    }));

    // Track sessions as tabs open and close so each open graph is watched.
    this.syncSessions();
    this.disposers.push(
      this.system.activeGraph.subscribe(() => this.syncSessions())
    );

    // React to enable/interval changes without a restart.
    this.disposers.push(
      this.system.systemSettings.subscribe(() => this.applySettings())
    );

    this.applySettings();
  }

  // ---------------------------------------------------------------------------
  // Suspension , the "no copy during inconsistent state" API.
  // ---------------------------------------------------------------------------

  /** Mark the start of a region where a snapshot would be unsafe. */
  suspend(): void {
    this.suspendDepth += 1;
  }

  /** End a region opened by {@link suspend}. */
  resume(): void {
    if (this.suspendDepth > 0) this.suspendDepth -= 1;
  }

  /** Whether snapshots are currently suspended. */
  get suspended(): boolean {
    return this.suspendDepth > 0;
  }

  /**
   * Run `fn` with snapshots suspended, resuming even if it throws. Use this to
   * bracket bulk mutations (loads, imports, programmatic rewrites) so an
   * autosave tick can never capture the graph mid-transition.
   */
  runExclusive<T>(fn: () => T): T {
    this.suspend();
    try {
      return fn();
    } finally {
      this.resume();
    }
  }

  // ---------------------------------------------------------------------------
  // Scheduling.
  // ---------------------------------------------------------------------------

  private intervalMs(): number {
    const raw = Number(
      this.system.getSetting(AUTOSAVE_INTERVAL_SECONDS) ??
        AUTOSAVE_DEFAULTS.intervalSeconds
    );
    const seconds = Number.isFinite(raw)
      ? Math.max(MIN_INTERVAL_SECONDS, raw)
      : AUTOSAVE_DEFAULTS.intervalSeconds;
    return seconds * 1000;
  }

  private maxCopies(): number {
    const raw = Number(
      this.system.getSetting(AUTOSAVE_MAX_COPIES) ?? AUTOSAVE_DEFAULTS.maxCopies
    );
    return Number.isFinite(raw) && raw >= 1
      ? Math.floor(raw)
      : AUTOSAVE_DEFAULTS.maxCopies;
  }

  /** (Re)start or stop the timer to match the current settings. */
  private applySettings(): void {
    const enabled =
      this.system.getSetting<boolean>(AUTOSAVE_ENABLED) === true &&
      this.backups.available;
    if (enabled) this.start();
    else this.stop();
  }

  private start(): void {
    this.stop();
    this.timer = setInterval(() => this.tick(), this.intervalMs());
    this.store.setState({ running: true });
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.store.setState({ running: false });
  }

  /** One scheduler pass: try to capture each open, dirty, settled graph. */
  private tick(): void {
    if (this.suspended) return;
    for (const session of Object.values(
      this.system.activeGraph.getState().sessions
    )) {
      this.captureSession(session);
    }
  }

  // ---------------------------------------------------------------------------
  // Capture.
  // ---------------------------------------------------------------------------

  /**
   * Snapshot one graph now if it is worth it: changed, settled, non-empty,
   * consistent and not a duplicate of the last capture. Returns the snapshot on
   * success, or null when it was skipped.
   */
  captureSession(session: GraphSession, force = false): BackupSnapshot | null {
    if (this.suspended) return null;
    const watch = this.watches.get(session.id);
    const now = Date.now();

    if (!force) {
      if (!watch?.dirty) return null;
      if (now - watch.lastChange < QUIESCE_MS) return null;
    }

    let graph: UIGraphJSON;
    try {
      graph = buildUIGraphJSON(session);
    } catch {
      // A graph that can't even be serialized is by definition inconsistent.
      return null;
    }

    // Skip empty graphs: an accidental "Clear" should not evict good backups.
    if (graph.nodes.length === 0) {
      if (watch) watch.dirty = false;
      return null;
    }

    if (!isConsistent(graph)) return null;

    const json = JSON.stringify(graph);
    if (watch && json === watch.lastCapturedJson) {
      watch.dirty = false;
      return null;
    }

    const snapshot: BackupSnapshot = {
      id: uuidv4(),
      graphId: session.id,
      name: session.name,
      timestamp: now,
      nodeCount: graph.nodes.length,
      graph
    };

    this.backups.append(snapshot, this.maxCopies());
    if (watch) {
      watch.dirty = false;
      watch.lastCapturedJson = json;
    }
    this.store.setState({
      snapshots: this.backups.listAll(),
      lastBackupAt: now
    });
    return snapshot;
  }

  /** Force an immediate backup of the focused graph (the "Back up now" action). */
  backupNow(): BackupSnapshot | null {
    const session = this.system.session;
    if (!session) return null;
    return this.captureSession(session, true);
  }

  // ---------------------------------------------------------------------------
  // Restore + management.
  // ---------------------------------------------------------------------------

  /**
   * Restore a snapshot into a brand-new graph tab, leaving all currently open
   * graphs untouched , the safe choice when recovering from a bad state.
   * Returns the new session, or undefined if the snapshot is gone.
   */
  restore(snapshotId: string): GraphSession | undefined {
    const snapshot = this.backups.find(snapshotId);
    if (!snapshot) return undefined;

    const session = this.system.newGraph(`${snapshot.name} (restored)`);
    this.runExclusive(() => {
      session.graph.deseralize(snapshot.graph);
      session.flowStore
        .getState()
        .setGraph(snapshot.graph.flow, { skipLayout: true });
    });
    this.system.notifications.success(
      `Restored "${snapshot.name}" into a new tab`
    );
    return session;
  }

  /** Delete one snapshot. */
  deleteSnapshot(id: string): void {
    this.backups.remove(id);
    this.refresh();
  }

  /** Delete every snapshot. */
  clearAll(): void {
    this.backups.clear();
    this.refresh();
  }

  /** Re-read storage into the reactive store (after an external change). */
  refresh(): void {
    this.store.setState({ snapshots: this.backups.listAll() });
  }

  // ---------------------------------------------------------------------------
  // Session watching.
  // ---------------------------------------------------------------------------

  /** Add watches for newly opened sessions, drop them for closed ones. */
  private syncSessions(): void {
    const sessions = this.system.activeGraph.getState().sessions;
    // Add watches for new sessions.
    for (const session of Object.values(sessions)) {
      if (!this.watches.has(session.id)) this.watchSession(session);
    }
    // Remove watches for sessions that have gone away.
    for (const [id, watch] of this.watches) {
      if (!(id in sessions)) {
        watch.unsubscribe();
        this.watches.delete(id);
      }
    }
  }

  private watchSession(session: GraphSession): void {
    const markDirty = () => {
      const watch = this.watches.get(session.id);
      if (!watch) return;
      watch.dirty = true;
      watch.lastChange = Date.now();
    };
    const unsubNodes = session.nodeStore.subscribe(markDirty);
    const unsubEdges = session.edgeStore.subscribe(markDirty);
    this.watches.set(session.id, {
      dirty: false,
      lastChange: 0,
      lastCapturedJson: '',
      unsubscribe: () => {
        unsubNodes();
        unsubEdges();
      }
    });
  }

  /** Tear down timers and subscriptions. */
  dispose(): void {
    this.stop();
    for (const watch of this.watches.values()) watch.unsubscribe();
    this.watches.clear();
    for (const dispose of this.disposers) {
      try {
        dispose();
      } catch {
        // ignore disposer errors
      }
    }
    this.disposers.length = 0;
  }
}
