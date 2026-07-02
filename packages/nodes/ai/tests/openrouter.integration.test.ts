import { describe, expect, it } from 'vitest';
import { generateText } from 'ai';
import { createModel } from '../src/providers/index.js';
import type { IAICredentials } from '../src/index.js';

// Live test against an OpenRouter free model , the exact path the runtime uses
// (createModel -> AI SDK). Skipped unless OPENROUTER_API_KEY is set, so it never
// runs (or costs) in CI by default. Run it with:
//   OPENROUTER_API_KEY=sk-or-... pnpm --filter @kiberon-labs/behave-graph-nodes-ai test
const apiKey = process.env.OPENROUTER_API_KEY;
const live = apiKey ? describe : describe.skip;

const FREE_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

live('OpenRouter free model (live)', () => {
  const credentials: IAICredentials = { getApiKey: () => apiKey };

  it('returns a non-empty reply from the free model', async () => {
    const model = createModel(
      {
        kind: 'openrouter',
        headers: {
          'HTTP-Referer': 'https://localhost',
          'X-Title': 'behave-graph test'
        }
      },
      FREE_MODEL,
      credentials
    );

    const { text } = await generateText({
      model,
      prompt: 'Reply with exactly the word: pong'
    });

    expect(text.trim().length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log('[openrouter] reply:', JSON.stringify(text));
  }, 30_000);
});
