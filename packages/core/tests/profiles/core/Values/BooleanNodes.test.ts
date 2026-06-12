import { describe, expect, it } from 'vitest';
import { testExec } from '../../../testUtils.js';
import * as Boolean_ from '@/Profiles/Core/Values/BooleanNodes.js';

const run = (node: { exec: any }, vals: Record<string, unknown>) =>
  testExec({ exec: node.exec, nodeInputVals: vals });

describe('BooleanNodes', () => {
  it('Constant passes its input through', async () => {
    expect((await run(Boolean_.Constant, { a: true })).result).toBe(true);
    expect((await run(Boolean_.Constant, { a: false })).result).toBe(false);
  });

  it('And returns the logical conjunction', async () => {
    expect((await run(Boolean_.And, { a: true, b: true })).result).toBe(true);
    expect((await run(Boolean_.And, { a: true, b: false })).result).toBe(false);
    expect((await run(Boolean_.And, { a: false, b: false })).result).toBe(
      false
    );
  });

  it('Or returns the logical disjunction', async () => {
    expect((await run(Boolean_.Or, { a: true, b: false })).result).toBe(true);
    expect((await run(Boolean_.Or, { a: false, b: false })).result).toBe(false);
  });

  it('Not negates the input', async () => {
    expect((await run(Boolean_.Not, { a: true })).result).toBe(false);
    expect((await run(Boolean_.Not, { a: false })).result).toBe(true);
  });

  it('Equal compares two booleans', async () => {
    expect((await run(Boolean_.Equal, { a: true, b: true })).result).toBe(true);
    expect((await run(Boolean_.Equal, { a: true, b: false })).result).toBe(
      false
    );
  });

  it('ToFloat maps booleans to 1 / 0', async () => {
    expect((await run(Boolean_.ToFloat, { a: true })).result).toBe(1);
    expect((await run(Boolean_.ToFloat, { a: false })).result).toBe(0);
  });

  it('toInteger maps booleans to 1n / 0n', async () => {
    expect((await run(Boolean_.toInteger, { a: true })).result).toBe(1n);
    expect((await run(Boolean_.toInteger, { a: false })).result).toBe(0n);
  });
});
