import {
  ContributionKind,
  PackageCategory,
  defineManifestSource,
  type Dependencies
} from '@kiberon-labs/behave-graph';
import { nodes } from './nodes/index.js';
import { values } from './values/index.js';
import pkg from '../package.json' with { type: 'json' };

/**
 * Build-time manifest source for the image package.
 *
 * The registry here is only used to project node/value *specs*  spec
 * generation instantiates nodes but never runs them, so no WASM init is needed.
 * The executable profile (with `ensureImageMagickInitialized`) lives behind the
 * `runtime` entry, loaded only by a runner. Contributions are plain pointers
 * into `./ui.js` / `./values/index.js`; no UI code is imported here.
 */
export default defineManifestSource({
  package: { name: pkg.name, version: pkg.version },
  registry: () => ({ nodes, values, dependencies: {} as Dependencies }),
  runtime: './index.js',
  categories: [PackageCategory.Effect],
  contributions: [
    {
      id: 'image',
      kind: ContributionKind.Control,
      export: './ui.js#ImageControl',
      bind: { controlName: 'image' }
    },
    {
      id: 'image-preview',
      kind: ContributionKind.Specific,
      export: './ui.js#imagePreviewSpecific'
    },
    {
      id: 'image-always-preview',
      kind: ContributionKind.Specific,
      export: './ui.js#imageAlwaysPreviewSpecific'
    },
    {
      id: 'imageOutput',
      kind: ContributionKind.Panel,
      export: './ui.js#imageOutputTab'
    },
    {
      id: 'image-value',
      kind: ContributionKind.ValueType,
      export: './values/index.js#ImageValue',
      bind: { valueType: 'image' }
    }
  ]
});
