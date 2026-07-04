import { describe, expect, it } from 'vitest';
import {
  createImageModel,
  createModel,
  resolveApiKey
} from '../src/providers/index.js';
// createModel builds a Vercel AI SDK LanguageModel. Constructing a model does
// not hit the network (that only happens on a request), so we can assert the
// wiring , model id + which provider was selected , offline.
function config(partial) {
  return { kind: 'openai', ...partial };
}
describe('createModel', () => {
  it('uses the OpenAI provider for openai/openrouter/custom kinds', () => {
    for (const kind of ['openai', 'openrouter', 'custom']) {
      const model = createModel(config({ kind }), 'gpt-4o-mini');
      expect(model).toBeTypeOf('object');
      const { modelId, provider } = model;
      expect(modelId).toBe('gpt-4o-mini');
      expect(provider).toContain('openai');
    }
  });
  it('uses the Anthropic provider for the anthropic kind', () => {
    const model = createModel(
      config({ kind: 'anthropic' }),
      'claude-sonnet-4-6'
    );
    const { modelId, provider } = model;
    expect(modelId).toBe('claude-sonnet-4-6');
    expect(provider).toContain('anthropic');
  });
  it('honors a custom baseURL without throwing', () => {
    expect(() =>
      createModel(
        config({ kind: 'custom', baseURL: 'https://example.test/v1' }),
        'some-model'
      )
    ).not.toThrow();
  });
});
describe('createImageModel', () => {
  it('builds an OpenAI image model for openai/openrouter/custom', () => {
    for (const kind of ['openai', 'openrouter', 'custom']) {
      const model = createImageModel(config({ kind }), 'dall-e-3');
      const { modelId, provider } = model;
      expect(modelId).toBe('dall-e-3');
      expect(provider).toContain('openai');
    }
  });
  it('throws for the anthropic kind (no image endpoint)', () => {
    expect(() =>
      createImageModel(config({ kind: 'anthropic' }), 'whatever')
    ).toThrow(/not supported/i);
  });
});
describe('resolveApiKey', () => {
  const credentials = {
    getApiKey: (ref) => ({ openai: 'sk-by-kind', 'my-key': 'sk-by-ref' })[ref]
  };
  it('resolves by credentialRef when set, else by provider kind', () => {
    expect(resolveApiKey(config({ kind: 'openai' }), credentials)).toBe(
      'sk-by-kind'
    );
    expect(
      resolveApiKey(
        config({ kind: 'openai', credentialRef: 'my-key' }),
        credentials
      )
    ).toBe('sk-by-ref');
  });
  it('returns empty string when there is no resolver or no match', () => {
    expect(resolveApiKey(config({ kind: 'openai' }), undefined)).toBe('');
    expect(resolveApiKey(config({ kind: 'anthropic' }), credentials)).toBe('');
  });
});
