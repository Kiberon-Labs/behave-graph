import { RealtimeRunner, System } from '@kiberon-labs/behave-graph-flow';
import { ensureImageMagickInitialized } from './wasm.js';
import { nodes } from './nodes/index.js';
import { values } from './values/index.js';
import { ImageControl } from './components/controls/image/index.js';
import { ImageOutputPanel } from './components/panels/output.js';
import {
  imageAlwaysPreviewSpecific,
  imagePreviewSpecific
} from './components/preview/index.js';
import { plugin } from '@kiberon-labs/behave-graph-flow';
import {
  DefaultLogger,
  ManualLifecycleEventEmitter,
  registerCoreProfile,
  writeNodeSpecsToJSON,
  type Dependencies,
  type IRegistry
} from '@kiberon-labs/behave-graph';

// Re-exported so a host can resolve them from this package's manifest
// contributions (`./ui.js#ImageControl`, etc.) without loading the whole plugin.
export { ImageControl } from './components/controls/image/index.js';
export { ImageOutputPanel } from './components/panels/output.js';
export {
  imagePreviewSpecific,
  imageAlwaysPreviewSpecific
} from './components/preview/index.js';

/**
 * Tab loader for the Image Output panel. Exported as a manifest `panel`
 * contribution (`./ui.js#imageOutputTab`) so a host can register it via the
 * tabLoader without the rest of the plugin.
 */
export const imageOutputTab = () => ({
  id: 'imageOutput',
  closable: true,
  cached: true,
  group: 'graph',
  title: 'Image Output',
  content: () => <ImageOutputPanel />
});

export interface ImagePluginOptions {
  /**
   * Executable registry used by the realtime preview runner to build and run a
   * live copy of the graph (this is what drives the inline node previews and the
   * Image Output panel). It must contain the node factories + value types for
   * every node type that can appear in the graph , at minimum the core profile ,
   * plus the engine dependencies (lifecycle emitter + logger).
   *
   * The image profile's own nodes/values are merged in automatically, so a host
   * normally passes the same registry it gives the local graph runner. If
   * omitted, a core-only execution registry is built automatically, which is
   * enough for graphs that use only core + image nodes.
   */
  registry?: IRegistry;
}

export const imagePlugin = plugin<ImagePluginOptions | void>(
  async (sys: System, options) => {
    await ensureImageMagickInitialized();

    const nodeSpecs = writeNodeSpecsToJSON({
      nodes: nodes,
      values: values,
      dependencies: {} as Dependencies
    });

    // Base execution registry for the preview runner. Default to a core profile
    // carrying the dependencies the engine needs (tick lifecycle + logger) when
    // the host doesn't supply one.
    const baseRegistry: IRegistry =
      (options && options.registry) ||
      registerCoreProfile({
        nodes: {},
        values: {},
        dependencies: {
          ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
          ILogger: new DefaultLogger()
        } as Dependencies
      });

    // Merge the image node factories + value types into the execution registry
    // so the runner can actually build and execute image graphs.
    const executionRegistry: IRegistry = {
      ...baseRegistry,
      nodes: { ...baseRegistry.nodes, ...nodes },
      values: { ...baseRegistry.values, ...values }
    };

    sys.decorate('realtimeRunner', new RealtimeRunner(sys, executionRegistry));
    sys.registry.getState().updateRegistry({
      specs: nodeSpecs,
      values: values
    });

    sys.controlStore.getState().registerControl('image', ImageControl);
    sys.specificStore.getState().registerSpecific(imagePreviewSpecific);
    // The dedicated `image/preview` node always shows its preview, even when the
    // `image.showPreview` setting below is turned off.
    sys.specificStore.getState().registerSpecific(imageAlwaysPreviewSpecific);

    // Contribute a setting so users can toggle the inline image previews on
    // image nodes from the Settings panel (auto-generated + persisted).
    sys.registerSetting({
      key: 'image.showPreview',
      section: 'Image',
      type: 'boolean',
      default: true,
      title: 'Show image previews',
      description:
        'Render image thumbnails inline on image-producing nodes in the graph.'
    });

    sys.tabLoader.register('imageOutput', imageOutputTab);
  },
  {
    name: 'image'
  }
);
