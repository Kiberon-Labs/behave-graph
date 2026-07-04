import {
  ContributionKind,
  MANIFEST_VERSION,
  type ContributionSpec,
  type ManifestJSON,
  type NodeManifestEntry,
  type ValueTypeSpecJSON
} from './ManifestJSON.js';

export type ParseManifestResult =
  | { ok: true; manifest: ManifestJSON }
  | { ok: false; errors: string[] };

const CONTRIBUTION_KINDS = new Set<string>(Object.values(ContributionKind));

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validate an untrusted, parsed JSON value as a {@link ManifestJSON}. This is
 * the well-formedness trust gate: a host runs it before loading anything from a
 * manifest. Reading a manifest never executes package code, but a malformed or
 * hostile manifest must not be allowed to drive the editor.
 */
export function parseManifest(input: unknown): ParseManifestResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['manifest must be an object'] };
  }

  if (input.manifestVersion !== MANIFEST_VERSION) {
    errors.push(
      `manifestVersion must be ${MANIFEST_VERSION}, got ${String(
        input.manifestVersion
      )}`
    );
  }

  validatePackage(input.package, errors);

  validateValues(input.values, errors);
  validateNodes(input.nodes, errors);
  validateContributions(input.contributions, errors);
  validateRequirements(input.requirements, errors);

  validateOptionalFields(input, errors);

  if (errors.length > 0) return { ok: false, errors };
  // Shape validated above; the cast is sound at this point.
  return { ok: true, manifest: input as unknown as ManifestJSON };
}

function validatePackage(pkg: unknown, errors: string[]): void {
  if (
    !isObject(pkg) ||
    typeof pkg.name !== 'string' ||
    typeof pkg.version !== 'string'
  ) {
    errors.push('package must be { name: string, version: string }');
  }
}

// The optional top-level scalars/collections: absent is fine, but a present
// value must match its declared shape.
function validateOptionalFields(
  input: Record<string, unknown>,
  errors: string[]
): void {
  if (input.runtime !== undefined && typeof input.runtime !== 'string') {
    errors.push('runtime must be a string when present');
  }

  if (
    input.categories !== undefined &&
    (!Array.isArray(input.categories) ||
      !input.categories.every((c) => typeof c === 'string'))
  ) {
    errors.push('categories must be an array of strings when present');
  }

  if (input.metadata !== undefined && !isObject(input.metadata)) {
    errors.push('metadata must be an object when present');
  }
}

function validateValues(values: unknown, errors: string[]): void {
  if (!Array.isArray(values)) {
    errors.push('values must be an array');
    return;
  }
  values.forEach((value, i) => {
    if (!isObject(value) || typeof value.name !== 'string') {
      errors.push(`values[${i}] must have a string name`);
    }
  });
}

function validateNodes(nodes: unknown, errors: string[]): void {
  if (!Array.isArray(nodes)) {
    errors.push('nodes must be an array');
    return;
  }
  nodes.forEach((node, i) => {
    if (!isObject(node)) {
      errors.push(`nodes[${i}] must be an object`);
      return;
    }
    if (typeof node.type !== 'string')
      errors.push(`nodes[${i}].type must be a string`);
    if (typeof node.label !== 'string')
      errors.push(`nodes[${i}].label must be a string`);
    if (!Array.isArray(node.inputs))
      errors.push(`nodes[${i}].inputs must be an array`);
    if (!Array.isArray(node.outputs))
      errors.push(`nodes[${i}].outputs must be an array`);
    if (!Array.isArray(node.configuration))
      errors.push(`nodes[${i}].configuration must be an array`);
  });
}

function validateContributions(contributions: unknown, errors: string[]): void {
  if (!Array.isArray(contributions)) {
    errors.push('contributions must be an array');
    return;
  }
  contributions.forEach((c, i) => {
    if (!isObject(c)) {
      errors.push(`contributions[${i}] must be an object`);
      return;
    }
    if (typeof c.id !== 'string')
      errors.push(`contributions[${i}].id must be a string`);
    if (typeof c.export !== 'string')
      errors.push(`contributions[${i}].export must be a string`);
    if (typeof c.kind !== 'string' || !CONTRIBUTION_KINDS.has(c.kind)) {
      errors.push(
        `contributions[${i}].kind must be one of ${[...CONTRIBUTION_KINDS].join(', ')}`
      );
    }
  });
}

function validateRequirements(requirements: unknown, errors: string[]): void {
  if (requirements === undefined) return;
  if (!Array.isArray(requirements)) {
    errors.push('requirements must be an array when present');
    return;
  }
  // Intentionally permissive: only the `kind` discriminant is required so the
  // schema can carry requirement kinds core does not yet model. Hosts decide
  // what to do with unknown kinds.
  requirements.forEach((req, i) => {
    if (!isObject(req) || typeof req.kind !== 'string') {
      errors.push(`requirements[${i}] must be an object with a string kind`);
    }
  });
}

// Re-export the entry types validated here for convenient consumer imports.
export type { ContributionSpec, NodeManifestEntry, ValueTypeSpecJSON };
