import { describe, expect, it } from 'vitest';
import { testExec } from '../../../testUtils.js';
import * as Integer from '@/Profiles/Core/Values/IntegerNodes.js';

const run = (node: { exec: any }, vals: Record<string, unknown>) =>
  testExec({ exec: node.exec, nodeInputVals: vals });

describe('IntegerNodes', () => {
  it('Constant passes its input through', async () => {
    expect((await run(Integer.Constant, { a: 7n })).result).toBe(7n);
  });

  it('Add sums two integers', async () => {
    expect((await run(Integer.Add, { a: 2n, b: 3n })).result).toBe(5n);
  });

  it('Subtract subtracts two integers', async () => {
    expect((await run(Integer.Subtract, { a: 10n, b: 4n })).result).toBe(6n);
  });

  it('Negate negates an integer', async () => {
    expect((await run(Integer.Negate, { a: 5n })).result).toBe(-5n);
  });

  it('Multiply multiplies two integers', async () => {
    expect((await run(Integer.Multiply, { a: 6n, b: 7n })).result).toBe(42n);
  });

  it('Divide performs integer (truncating) division', async () => {
    expect((await run(Integer.Divide, { a: 7n, b: 2n })).result).toBe(3n);
  });

  it('Modulus returns the remainder', async () => {
    expect((await run(Integer.Modulus, { a: 7n, b: 3n })).result).toBe(1n);
  });

  it('ToFloat converts a bigint to a number', async () => {
    const result = (await run(Integer.ToFloat, { a: 5n })).result;
    expect(result).toBe(5);
    expect(typeof result).toBe('number');
  });

  it('Min returns the smaller value', async () => {
    expect((await run(Integer.Min, { a: 2n, b: 9n })).result).toBe(2n);
  });

  it('Max returns the larger value', async () => {
    expect((await run(Integer.Max, { a: 2n, b: 9n })).result).toBe(9n);
  });

  it('Clamp constrains a value to the [min, max] range', async () => {
    // Clamp uses named input sockets: value / min / max
    expect(
      (await run(Integer.Clamp, { value: 5n, min: 0n, max: 10n })).result
    ).toBe(5n);
    expect(
      (await run(Integer.Clamp, { value: -3n, min: 0n, max: 10n })).result
    ).toBe(0n);
    expect(
      (await run(Integer.Clamp, { value: 50n, min: 0n, max: 10n })).result
    ).toBe(10n);
  });

  it('Abs returns the absolute value', async () => {
    expect((await run(Integer.Abs, { a: -8n })).result).toBe(8n);
    expect((await run(Integer.Abs, { a: 8n })).result).toBe(8n);
  });

  it('Sign returns -1, 0 or 1', async () => {
    expect((await run(Integer.Sign, { a: -8n })).result).toBe(-1n);
    expect((await run(Integer.Sign, { a: 0n })).result).toBe(0n);
    expect((await run(Integer.Sign, { a: 8n })).result).toBe(1n);
  });

  it('Equal compares two integers', async () => {
    expect((await run(Integer.Equal, { a: 3n, b: 3n })).result).toBe(true);
    expect((await run(Integer.Equal, { a: 3n, b: 4n })).result).toBe(false);
  });

  it('comparison operators behave correctly', async () => {
    expect((await run(Integer.GreaterThan, { a: 4n, b: 3n })).result).toBe(true);
    expect((await run(Integer.GreaterThanOrEqual, { a: 3n, b: 3n })).result).toBe(
      true
    );
    expect((await run(Integer.LessThan, { a: 2n, b: 3n })).result).toBe(true);
    expect((await run(Integer.LessThanOrEqual, { a: 3n, b: 3n })).result).toBe(
      true
    );
  });

  it('toBoolean is false for 0 and true otherwise', async () => {
    expect((await run(Integer.toBoolean, { a: 0n })).result).toBe(false);
    expect((await run(Integer.toBoolean, { a: 1n })).result).toBe(true);
  });
});
