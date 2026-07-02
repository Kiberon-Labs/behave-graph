import type { Preview, Decorator } from '@storybook/react-vite';
import { themes } from 'storybook/theming';
import '../src/index.css';
import './styles.css';

/**
 * Apply the selected editor theme by setting `data-flow-theme` on the preview
 * <html>. The design system's `--ds-*` tokens cascade from there, so this
 * re-skins every story. `default` removes the attribute (built-in look); any
 * other value matches a scoped theme in src/css/themes/ (e.g. `kiberon`).
 */
const withFlowTheme: Decorator = (Story, context) => {
  const theme = context.globals.flowTheme as string | undefined;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (theme && theme !== 'default') {
      root.setAttribute('data-flow-theme', theme);
    } else {
      root.removeAttribute('data-flow-theme');
    }
  }
  return Story();
};

const preview: Preview = {
  decorators: [withFlowTheme],
  globalTypes: {
    flowTheme: {
      description: 'Editor design-system theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'default', title: 'Default (VS Code-style)' },
          { value: 'kiberon', title: 'Kiberon Labs' }
        ],
        dynamicTitle: true
      }
    }
  },
  parameters: {
    docs: {
      theme: themes.dark
    },
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#1f1f1f' },
        light: { name: 'Light', value: '#ffffff' }
      }
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  },
  initialGlobals: {
    backgrounds: { value: 'dark' },
    flowTheme: 'default'
  }
};

export default preview;
