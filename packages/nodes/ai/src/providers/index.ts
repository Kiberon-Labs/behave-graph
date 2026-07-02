import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { ImageModel, LanguageModel } from 'ai';
import type { IAICredentials } from '../abstractions/IAICredentials.js';
import type { ProviderConfig } from '../abstractions/types.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Resolve the API key for a provider config from the host-injected credentials.
 * The graph carries only a non-secret reference (`credentialRef`, or the
 * provider `kind` when blank) , the secret is looked up here, never stored.
 */
export function resolveApiKey(
  config: ProviderConfig,
  credentials: IAICredentials | undefined
): string {
  const ref = config.credentialRef || config.kind;
  return credentials?.getApiKey(ref) ?? '';
}

/**
 * Build a Vercel AI SDK {@link LanguageModel} from a serializable
 * {@link ProviderConfig} + model id, resolving the API key from the injected
 * {@link IAICredentials}.
 *
 * `openai` and `custom` use the OpenAI provider (point `custom` at any
 * OpenAI-compatible endpoint via `baseURL`); `openrouter` is the OpenAI provider
 * aimed at OpenRouter; `anthropic` uses the Anthropic provider.
 */
export function createModel(
  config: ProviderConfig,
  modelId: string,
  credentials?: IAICredentials
): LanguageModel {
  const apiKey = resolveApiKey(config, credentials);
  switch (config.kind) {
    case 'anthropic': {
      const provider = createAnthropic({ apiKey, baseURL: config.baseURL });
      return provider(modelId);
    }
    case 'openrouter': {
      const provider = createOpenAI({
        apiKey,
        baseURL: config.baseURL ?? OPENROUTER_BASE_URL,
        headers: config.headers
      });
      return provider(modelId);
    }
    case 'openai':
    case 'custom':
    default: {
      const provider = createOpenAI({
        apiKey,
        baseURL: config.baseURL,
        headers: config.headers
      });
      return provider(modelId);
    }
  }
}

/**
 * Build a Vercel AI SDK {@link ImageModel} from a {@link ProviderConfig} + model
 * id, for image generation, resolving the API key from the injected
 * {@link IAICredentials}. Uses the OpenAI image API (openai/openrouter/custom);
 * Anthropic has no image-generation endpoint, so that kind throws.
 */
export function createImageModel(
  config: ProviderConfig,
  modelId: string,
  credentials?: IAICredentials
): ImageModel {
  if (config.kind === 'anthropic') {
    throw new Error(
      'Image generation is not supported by the Anthropic provider.'
    );
  }

  const provider = createOpenAI({
    apiKey: resolveApiKey(config, credentials),
    baseURL:
      config.kind === 'openrouter'
        ? (config.baseURL ?? OPENROUTER_BASE_URL)
        : config.baseURL,
    headers: config.headers
  });
  return provider.image(modelId);
}
