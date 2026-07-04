import {
  makePureInOutFunctionDesc,
  NodeCategory
} from '@kiberon-labs/behave-graph';
import type { ProviderConfig, ProviderKind } from '../abstractions/types.js';

/**
 * Builds a provider configuration value. Generic across backends , pick the
 * `kind` (direct OpenAI, direct Anthropic, OpenRouter, or any OpenAI-compatible
 * `custom` endpoint).
 *
 * No API key here , on purpose. `credentialRef` is a NON-SECRET name the host
 * resolves to a real key at call time via the injected `IAICredentials` (blank →
 * resolved by `kind`). Keys never live in the node or the saved graph.
 */
export const Provider = makePureInOutFunctionDesc({
  typeName: 'ai/provider',
  label: 'AI: Provider',
  category: NodeCategory.Logic,
  in: {
    kind: {
      valueType: 'string',
      defaultValue: 'openai',
      choices: ['openai', 'anthropic', 'openrouter', 'custom'],
      label: 'kind'
    },
    credentialRef: {
      valueType: 'string',
      defaultValue: '',
      label: 'credentialRef'
    },
    baseURL: {
      valueType: 'string',
      defaultValue: '',
      label: 'baseURL'
    },
    defaultModel: {
      valueType: 'string',
      defaultValue: '',
      label: 'defaultModel'
    }
  },
  out: {
    provider: 'aiProvider'
  },
  exec: ({ read, write }) => {
    const credentialRef = read<string>('credentialRef');
    const baseURL = read<string>('baseURL');
    const defaultModel = read<string>('defaultModel');
    const config: ProviderConfig = {
      kind: read<ProviderKind>('kind'),
      credentialRef: credentialRef ? credentialRef : undefined,
      baseURL: baseURL ? baseURL : undefined,
      defaultModel: defaultModel ? defaultModel : undefined
    };
    write('provider', config);
  }
});
