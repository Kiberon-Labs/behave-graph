import { System } from '@kiberon-labs/behave-graph-flow';
import { ensureImageMagickInitialized } from './wasm.js';
import { nodes } from './nodes/index.js';
import { values } from './values/index.js';
import { ImageControl } from './components/controls/image/index.js';
import { ImageOutputPanel } from './components/panels/output.js';
import { imagePreviewSpecific } from './components/preview/index.js';
import { plugin } from '@kiberon-labs/behave-graph-flow';
import {
  writeNodeSpecsToJSON,
  type Dependencies
} from '@kiberon-labs/behave-graph';

export const imagePlugin = plugin(
  async (sys: System) => {
    await ensureImageMagickInitialized();

    const nodeSpecs = writeNodeSpecsToJSON({
      nodes: nodes,
      values: values,
      dependencies: {} as Dependencies
    });
    // sys.decorate('realtimeRunner', new RealtimeRunner(sys));
    sys.registry.getState().updateRegistry({
      specs: nodeSpecs,
      values: values
    });

    sys.controlStore.getState().registerControl('image', ImageControl);
    sys.specificStore.getState().registerSpecific(imagePreviewSpecific);

    sys.tabLoader.register('imageOutput', () => {
      return {
        id: 'imageOutput',
        closable: true,
        cached: true,
        group: 'graph',
        title: 'Image Output',
        content: () => <ImageOutputPanel />
      };
    });
  },
  {
    name: 'image'
  }
);
