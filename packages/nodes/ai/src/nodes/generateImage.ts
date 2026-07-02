import { makePureInOutFunctionDesc, NodeCategory } from '@kiberon-labs/behave-graph';
import { generateImage } from 'ai';
import type { ProviderConfig } from '../abstractions/types.js';
import { createImageModel } from '../providers/index.js';

/**
 * Generates an image from a text prompt and outputs it as an `image` value ,
 * the same value type the image package defines. Connect `image` into an
 * `output/image` node (or any image node) to visualize the result inline / in
 * the Image Output panel. Name-coupled: this only needs the image profile's
 * `image` value type to be registered, not a hard dependency.
 *
 * Image generation costs money and hits the network, so errors are swallowed
 * (logged) on purpose: `makePureInOutFunctionDesc` records the attempt, so the
 * preview runner won't re-fire the same prompt every tick. Change an input to
 * retry.
 */
export const GenerateImage = makePureInOutFunctionDesc({
  typeName: 'ai/generateImage',
  label: 'AI: Generate Image',
  category: NodeCategory.Logic,
  in: {
    provider: {
      valueType: 'aiProvider',
      defaultValue: undefined,
      label: 'provider'
    },
    model: {
      valueType: 'string',
      defaultValue: 'dall-e-3',
      label: 'model'
    },
    prompt: {
      valueType: 'string',
      defaultValue: '',
      label: 'prompt'
    },
    size: {
      valueType: 'string',
      defaultValue: '1024x1024',
      choices: ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'],
      label: 'size'
    }
  },
  out: {
    image: 'image'
  },
  exec: async ({ read, write, graph }) => {
    const provider = read<ProviderConfig | undefined>('provider');
    const prompt = read<string>('prompt');
    if (!provider || !prompt) return;

    const model = read<string>('model') || provider.defaultModel || 'dall-e-3';
    const size = read<string>('size');
    const credentials = graph.getDependency('IAICredentials');

    try {
      const result = await generateImage({
        model: createImageModel(provider, model, credentials),
        prompt,
        size: size as `${number}x${number}`
      });
      write('image', result.image.uint8Array);
    } catch (err) {
      console.error('ai/generateImage failed:', err);
    }
  }
});
