import type { Preview } from '@storybook/react-vite';
import '@kiberon-labs/behave-graph-flow/dist/entry.css';
import './vscode.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
};

export default preview;
