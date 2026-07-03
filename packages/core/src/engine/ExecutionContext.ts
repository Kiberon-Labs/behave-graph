/**
 * Typed capability access — an additive alternative to the stringly-typed
 * `graph.getDependency('SomeKey')` service-locator.
 *
 * A host declares a {@link CapabilityKey} once (carrying the service's type),
 * provides an implementation in the registry's `dependencies` bag under the
 * key's `id`, and nodes read it back through an {@link ExecutionContext} with
 * full type safety and no `any`. Unlike `getDependency`, custom host services
 * (an HTTP client, an audio context, a database handle) are first-class and
 * type-checked at every call site.
 *
 * This is intentionally a thin, opt-in layer: it does not change how existing
 * nodes resolve dependencies, so it can be adopted incrementally.
 */

/** An opaque, typed handle for a host-provided capability. */
export interface CapabilityKey<T> {
  readonly id: string;
  /** Phantom type — never present at runtime. */
  readonly __capability?: T;
}

/** Declare a capability key. The type parameter carries the service's shape. */
export const defineCapability = <T>(id: string): CapabilityKey<T> => ({ id });

/** A type-safe view over a bag of host-provided capabilities. */
export interface ExecutionContext {
  /** Return the capability implementation, or `undefined` if not provided. */
  get<T>(key: CapabilityKey<T>): T | undefined;
  /** Return the capability implementation, throwing if it is not provided. */
  require<T>(key: CapabilityKey<T>): T;
  /** Whether a capability has been provided. */
  has<T>(key: CapabilityKey<T>): boolean;
}

/**
 * Build an {@link ExecutionContext} over any record of services keyed by
 * capability id. Pass `registry.dependencies` (which is an open record) or a
 * dedicated capability bag.
 */
export const makeExecutionContext = (
  bag: Readonly<Record<string, unknown>>
): ExecutionContext => ({
  get<T>(key: CapabilityKey<T>): T | undefined {
    return bag[key.id] as T | undefined;
  },
  require<T>(key: CapabilityKey<T>): T {
    const value = bag[key.id];
    if (value === undefined || value === null) {
      throw new Error(
        `Required capability '${key.id}' was not provided to the execution context`
      );
    }
    return value as T;
  },
  has<T>(key: CapabilityKey<T>): boolean {
    return bag[key.id] !== undefined && bag[key.id] !== null;
  }
});
