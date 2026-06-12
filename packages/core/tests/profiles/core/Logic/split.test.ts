import { describe, expect, it } from 'vitest';
import { testExec } from '../../../testUtils.js';
import { stringSplit } from '@/Profiles/Core/Logic/split.js';

describe('stringSplit', () => {
  it('splits a string on the given separator', async () => {
    const outputs = await testExec({
      exec: stringSplit.exec,
      nodeInputVals: { string: 'a,b,c', seperator: ',' }
    });

    expect(outputs.result).toEqual(['a', 'b', 'c']);
  });

  it('returns a single-element array when the separator is absent', async () => {
    const outputs = await testExec({
      exec: stringSplit.exec,
      nodeInputVals: { string: 'abc', seperator: ',' }
    });

    expect(outputs.result).toEqual(['abc']);
  });

  it('treats the separator as a regular expression', async () => {
    const outputs = await testExec({
      exec: stringSplit.exec,
      nodeInputVals: { string: 'a1b2c3d', seperator: '[0-9]' }
    });

    expect(outputs.result).toEqual(['a', 'b', 'c', 'd']);
  });
});
