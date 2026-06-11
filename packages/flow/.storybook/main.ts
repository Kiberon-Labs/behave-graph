import { loadEnv } from 'vite';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  viteFinal(config) {
    const env = loadEnv(config.mode ?? 'development', process.cwd(), 'VITE_');
    config.define = {
      ...config.define,
      ...Object.fromEntries(
        Object.entries(env).map(([k, v]) => [
          `import.meta.env.${k}`,
          JSON.stringify(v)
        ])
      )
    };
    return config;
  }
};
export default config;
