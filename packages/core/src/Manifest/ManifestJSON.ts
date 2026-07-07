import type { ValueJSON } from '../Graphs/IO/GraphJSON.js';
import type { NodeSpecJSON } from '../Graphs/IO/NodeSpecJSON.js';

/**
 * Static, function-free display metadata for a value type. The runtime
 * behaviour (creator/serialize/lerp/...) is intentionally absent so a host can
 * read this without importing or executing the package that defines it. The
 * editor synthesises a passthrough {@link ValueType} from this until (and
 * unless) the real one is trusted-loaded via a `valueType` contribution.
 */
export type ValueTypeSpecJSON = {
  name: string;
  /** Serialized default value, i.e. `serialize(creator())`. */
  defaultJSON: ValueJSON | null;
  label?: string;
  color?: string;
};

/** Surfaces a node package can extend in the editor, each backed by code. */
export const ContributionKind = {
  /** Custom socket input control, keyed by control/value name. */
  Control: 'control',
  /** Custom node renderer ("specific"). */
  Specific: 'specific',
  /** A dockable panel/tab. */
  Panel: 'panel',
  /** Config-driven socket generator. */
  SocketGenerator: 'socketGenerator',
  /** Socket value-type conversion rule. */
  Conversion: 'conversion',
  /** Editor command. */
  Command: 'command',
  /** Context-menu entry. */
  ContextMenu: 'contextMenu',
  /** Function-bearing value-type behaviour (replaces the passthrough). */
  ValueType: 'valueType'
} as const;

export type ContributionKind =
  (typeof ContributionKind)[keyof typeof ContributionKind];

/** What a {@link ContributionSpec} binds to, by kind. */
export type ContributionBinding = {
  /** Value type this contribution applies to (control, valueType). */
  valueType?: string;
  /** Node types this contribution applies to (specific, socketGenerator). */
  nodeTypes?: string[];
  /** Control name (control). */
  controlName?: string;
};

/**
 * A declarative pointer to a code contribution. The `export` is a module
 * specifier + named export, e.g. `"./ui.js#ImageControl"`, resolved relative
 * to the package root and imported lazily, only under the host's trust gate.
 */
export type ContributionSpec = {
  id: string;
  kind: ContributionKind;
  export: string;
  bind?: ContributionBinding;
};

/**
 * A node entry in the manifest: the static {@link NodeSpecJSON} the editor
 * already consumes, plus optional authoring extras.
 */
export type NodeManifestEntry = NodeSpecJSON & {
  helpDescription?: string;
  aliases?: string[];
  /**
   * True when this node's sockets are derived from its configuration at author
   * time (a `SocketsGeneratorFromConfig`). The editor must resolve them through
   * the named socket generator rather than treating the manifest sockets as
   * final.
   */
  dynamicSockets?: boolean;
  socketGeneratorId?: string;
};

/**
 * Open-ended classification of a node package. The constants below are the
 * well-known values, but {@link ManifestJSON.categories} accepts any string so
 * new classifications never require a schema bump.
 */
export const PackageCategory = {
  /** Deterministic nodes, no external IO. */
  Pure: 'pure',
  /** Performs IO but needs no persistent host component. */
  Io: 'io',
  /** Integrates a third-party service (Slack, GitHub, ...). */
  Integration: 'integration',
  /** Produces side effects in a host environment (scene, DOM, ...). */
  Effect: 'effect'
} as const;

export type PackageCategory =
  (typeof PackageCategory)[keyof typeof PackageCategory];

/**
 * Declares that the package needs a persistent, long-lived host process to
 * function fully  e.g. Slack trigger nodes that rely on a standing WebSocket
 * connection and an out-of-band signal that can wake up and start a graph. The
 * `entry` module is loaded and kept alive by a host that supports backends; a
 * pure editor/runner may surface the requirement and run everything else.
 */
export type BackendServiceRequirement = {
  kind: 'backendService';
  /** Human-readable explanation of why a persistent host is required. */
  reason?: string;
  /** Module specifier the host loads to run the persistent component. */
  entry?: string;
  /** The host must keep this alive across (and between) graph runs. */
  persistent?: boolean;
  /** This service can originate events that start or wake a graph. */
  providesTriggers?: boolean;
  /** Node types whose execution depends on this backend being live. */
  dependentNodes?: string[];
  /** Transport hint, e.g. 'websocket' | 'http' | 'poll'. Open string. */
  transport?: string;
};

/** Configuration / secrets a package needs from its host (e.g. API tokens). */
export type ConfigRequirement = {
  kind: 'config';
  keys: Array<{
    name: string;
    required?: boolean;
    secret?: boolean;
    description?: string;
  }>;
};

/** Well-known, typed host requirements. */
export type KnownRequirement = BackendServiceRequirement | ConfigRequirement;

/**
 * A capability/requirement a package declares to its host, discriminated by
 * `kind`. The trailing open member is deliberate: hosts must tolerate unknown
 * kinds (ignore or surface them) so the manifest can describe situations not
 * yet modelled here without a version bump.
 */
export type PackageRequirement =
  | KnownRequirement
  | { kind: string;[key: string]: unknown };

/** Current manifest schema version. Bump on breaking shape changes. */
export const MANIFEST_VERSION = 1 as const;

/**
 * Canonical manifest filename. A plain `.json` file so any JSON loader reads it
 * directly  `behave-graph.manifest` is only the descriptive base name, not a
 * custom file type. Hosts that scan for manifests should look for this name.
 */
export const MANIFEST_FILE_NAME = 'behave-graph.manifest.json';

/** `package.json` field whose value is the path to a package's manifest file. */
export const MANIFEST_PACKAGE_FIELD = 'behaveGraph';

/**
 * The static contract a node package ships so the flow UI and the vscode
 * extension can discover everything it provides without importing its code.
 * Generated at build time from the package's own (trusted) registry.
 */
export type ManifestJSON = {
  manifestVersion: typeof MANIFEST_VERSION;
  package: { name: string; version: string };
  values: ValueTypeSpecJSON[];
  nodes: NodeManifestEntry[];
  contributions: ContributionSpec[];
  /**
   * Module specifier whose `registerProfile` builds the executable registry.
   * Imported ONLY by a runner, only when a graph is actually executed.
   */
  runtime?: string;
  /** Open-ended classification of the package (see {@link PackageCategory}). */
  categories?: string[];
  /**
   * Host capabilities the package needs or ships (persistent backends, secrets,
   * ...). Hosts must tolerate unknown {@link PackageRequirement} kinds.
   */
  requirements?: PackageRequirement[];
  /** Arbitrary forward-compatible extension data, ignored by core. */
  metadata?: Record<string, unknown>;
};
