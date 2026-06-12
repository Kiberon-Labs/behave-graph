import { describe, expect, it } from 'vitest';
import { testExec } from '../../../testUtils.js';
import * as Str from '@/Profiles/Core/Values/StringNodes.js';

const run = (node: { exec: any }, vals: Record<string, unknown>) =>
  testExec({ exec: node.exec, nodeInputVals: vals });

describe('StringNodes', () => {
  it('Constant passes its input through', async () => {
    expect((await run(Str.Constant, { a: 'hello' })).result).toBe('hello');
  });

  it('Concat joins two strings', async () => {
    expect((await run(Str.Concat, { a: 'foo', b: 'bar' })).result).toBe(
      'foobar'
    );
  });

  it('Includes detects a substring', async () => {
    expect((await run(Str.Includes, { a: 'hello world', b: 'world' })).result).toBe(
      true
    );
    expect((await run(Str.Includes, { a: 'hello world', b: 'xyz' })).result).toBe(
      false
    );
  });

  it('Length returns the string length as a bigint', async () => {
    const result = (await run(Str.Length, { a: 'hello' })).result;
    expect(result).toBe(5n);
    expect(typeof result).toBe('bigint');
  });

  it('Equal compares two strings', async () => {
    expect((await run(Str.Equal, { a: 'abc', b: 'abc' })).result).toBe(true);
    expect((await run(Str.Equal, { a: 'abc', b: 'abd' })).result).toBe(false);
  });
});
