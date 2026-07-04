import type { UIGraphJSON } from '@/types/graph';
import type { SettingsStorage } from '@/system/system';

/** Single local-storage key holding every graph's backup ring. */
export const AUTOSAVE_STORAGE_KEY = 'behave-graph:autosave';

/** A single point-in-time copy of one graph. */
export type BackupSnapshot = {
  /** Unique id for this snapshot (used by the panel to restore/delete). */
  id: string;
  /** Session id of the graph this snapshot came from. */
  graphId: string;
  /** Graph display name captured at snapshot time (for the panel list). */
  name: string;
  /** Epoch milliseconds when the snapshot was taken. */
  timestamp: number;
  /** Node count, shown in the panel without deserializing the whole graph. */
  nodeCount: number;
  /** The full, restorable graph document. */
  graph: UIGraphJSON;
};

/** Per-graph ring buffer of snapshots, newest last. */
type GraphBackups = {
  name: string;
  snapshots: BackupSnapshot[];
};

/** The persisted shape: graph id -> its backups. */
type BackupStore = Record<string, GraphBackups>;

/**
 * localStorage-or-nothing accessor. The whole backup set lives under a single
 * key as a JSON object, so a plain get/set storage adapter (the same shape the
 * settings persistence uses) is all we need , no `key(i)`/`length` scanning.
 */
const defaultStorage = (): SettingsStorage | undefined => {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage can throw in sandboxed / SSR contexts.
  }
  return undefined;
};

const readStore = (storage: SettingsStorage): BackupStore => {
  try {
    const raw = storage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as BackupStore) : {};
  } catch {
    return {};
  }
};

const writeStore = (storage: SettingsStorage, store: BackupStore): void => {
  try {
    storage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded / serialization error: drop this write rather than throw.
    // The next successful snapshot will re-establish the ring.
  }
};

/**
 * Thin persistence wrapper over the single backup key. Kept storage-agnostic
 * (any get/set adapter) so hosts can back it with something other than
 * localStorage and tests can inject an in-memory map.
 */
export class BackupStorage {
  private readonly storage: SettingsStorage | undefined;

  constructor(storage: SettingsStorage | undefined = defaultStorage()) {
    this.storage = storage;
  }

  /** Whether a backing store is available (false in SSR / sandboxed contexts). */
  get available(): boolean {
    return this.storage !== undefined;
  }

  /** All snapshots across every graph, newest first. */
  listAll(): BackupSnapshot[] {
    if (!this.storage) return [];
    const store = readStore(this.storage);
    return Object.values(store)
      .flatMap((g) => g.snapshots)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /** Find one snapshot by id (across all graphs). */
  find(id: string): BackupSnapshot | undefined {
    return this.listAll().find((s) => s.id === id);
  }

  /**
   * Append a snapshot to its graph's ring and trim to `maxCopies` (oldest
   * dropped). `name` refreshes the stored graph label so the panel tracks
   * renames.
   */
  append(snapshot: BackupSnapshot, maxCopies: number): void {
    if (!this.storage) return;
    const store = readStore(this.storage);
    const entry = store[snapshot.graphId] ?? {
      name: snapshot.name,
      snapshots: []
    };
    entry.name = snapshot.name;
    entry.snapshots = [...entry.snapshots, snapshot];
    const limit = Math.max(1, Math.floor(maxCopies));
    if (entry.snapshots.length > limit) {
      entry.snapshots = entry.snapshots.slice(entry.snapshots.length - limit);
    }
    store[snapshot.graphId] = entry;
    writeStore(this.storage, store);
  }

  /** Remove a single snapshot; prunes the graph entry once it is empty. */
  remove(id: string): void {
    if (!this.storage) return;
    const store = readStore(this.storage);
    for (const [graphId, entry] of Object.entries(store)) {
      const next = entry.snapshots.filter((s) => s.id !== id);
      if (next.length === entry.snapshots.length) continue;
      if (next.length === 0) delete store[graphId];
      else store[graphId] = { ...entry, snapshots: next };
      writeStore(this.storage, store);
      return;
    }
  }

  /** Drop every snapshot for a single graph. */
  removeGraph(graphId: string): void {
    if (!this.storage) return;
    const store = readStore(this.storage);
    if (!(graphId in store)) return;
    delete store[graphId];
    writeStore(this.storage, store);
  }

  /** Wipe all backups. */
  clear(): void {
    if (!this.storage) return;
    writeStore(this.storage, {});
  }
}
