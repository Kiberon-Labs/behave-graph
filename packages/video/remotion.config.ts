// Remotion project config. The entry point registers the compositions; scene
// timing is computed at runtime from the narration manifest.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Config } from '@remotion/cli/config';
import { webpack } from '@remotion/bundler';

// The config is transpiled to CJS, where import.meta.url is unavailable 
// resolve relative to the package dir (the CLI always runs from here).
const require = createRequire(join(process.cwd(), 'package.json'));

Config.setEntryPoint('./src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The editor scenes RUN graphs via the local graph runner, which executes on
// timers as frames advance. Parallel render chunks would each cold-start the
// run and give it only a handful of frames  render sequentially so execution,
// logs, traces and previews progress exactly once, in order.
Config.setConcurrency(1);

// The image node pack loads ImageMagick in the browser via a Vite-style
// `@imagemagick/magick-wasm/magick.wasm?url` import. Webpack can't resolve the
// `?url` suffix through the package's exports field, so rewrite the request to
// the real wasm file and emit it as an asset URL (which is exactly what the
// `?url` idiom means in Vite).
Config.overrideWebpackConfig((config) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    new webpack.NormalModuleReplacementPlugin(
      /magick\.wasm\?url$/,
      (resource: { request: string }) => {
        resource.request =
          require.resolve('@imagemagick/magick-wasm/magick.wasm');
      }
    ),
    // The pack's Node-runtime fallback dynamically imports node: builtins from a
    // branch the browser never takes; stub them out instead of bundling them.
    new webpack.IgnorePlugin({
      resourceRegExp: /^node:(module|path|fs\/promises)$/
    })
  ],
  module: {
    ...config.module,
    rules: [
      ...(config.module?.rules ?? []),
      { test: /magick\.wasm$/, type: 'asset/resource' }
    ]
  }
}));
