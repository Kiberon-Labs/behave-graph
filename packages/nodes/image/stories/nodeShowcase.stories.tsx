import type { Meta, StoryObj } from '@storybook/react-vite';
import { LayoutController } from '@kiberon-labs/behave-graph-flow';
import { CategoryShowcaseProvider } from './defaults/showcaseStoryProvider';

/**
 * Node showcase, split by high-level interaction. Each story drives one category
 * of image nodes from a single Unsplash reference image so you can see each
 * node's effect via its inline preview.
 *
 * Tip: open Settings and toggle "Show image previews" (`image.showPreview`).
 * Every inline preview hides EXCEPT the dedicated `Image: Preview` node (see the
 * "Output & Preview" story), which always stays visible.
 */
const meta: Meta<typeof LayoutController> = {
  title: 'Image/Node Showcase',
  component: LayoutController,
  parameters: {
    layout: 'fullscreen'
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

const categoryStory = (category: string): Story => ({
  render: () => (
    <div style={{ height: '100vh' }}>
      <LayoutController />
    </div>
  ),
  decorators: [
    (Story) => (
      <CategoryShowcaseProvider category={category}>
        <Story />
      </CategoryShowcaseProvider>
    )
  ]
});

export const Sources = categoryStory('Sources');
export const Geometry = categoryStory('Geometry');
export const ColorAndTone = categoryStory('Color & Tone');
export const AlphaAndColor = categoryStory('Alpha & Color');
export const Effects = categoryStory('Effects');
export const CompositingAndFormat = categoryStory('Compositing & Format');
export const OutputAndPreview = categoryStory('Output & Preview');
