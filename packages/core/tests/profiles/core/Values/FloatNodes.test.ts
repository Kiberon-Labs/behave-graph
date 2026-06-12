import { describe, expect, it } from 'vitest';
import { testExec } from '../../../testUtils.js';
import * as Float from '@/Profiles/Core/Values/FloatNodes.js';

const run = (node: { exec: any }, vals: Record<string, unknown> = {}) =>
  testExec({ exec: node.exec, nodeInputVals: vals });

describe('FloatNodes', () => {
  it('Add / Subtract / Multiply / Divide', async () => {
    expect((await run(Float.Add, { a: 1.5, b: 2.25 })).result).toBe(3.75);
    expect((await run(Float.Subtract, { a: 5, b: 1.5 })).result).toBe(3.5);
    expect((await run(Float.Multiply, { a: 2, b: 3.5 })).result).toBe(7);
    expect((await run(Float.Divide, { a: 7, b: 2 })).result).toBe(3.5);
  });

  it('Negate negates the input', async () => {
    expect((await run(Float.Negate, { a: 4 })).result).toBe(-4);
  });

  it('Modulus returns the floating-point remainder', async () => {
    expect((await run(Float.Modulus, { a: 7.5, b: 2 })).result).toBe(1.5);
  });

  it('Power raises a to the b', async () => {
    expect((await run(Float.Power, { a: 2, b: 10 })).result).toBe(1024);
  });

  it('Mix linearly interpolates between a and b', async () => {
    expect((await run(Float.Mix, { a: 0, b: 10, c: 0 })).result).toBe(0);
    expect((await run(Float.Mix, { a: 0, b: 10, c: 1 })).result).toBe(10);
    expect((await run(Float.Mix, { a: 0, b: 10, c: 0.5 })).result).toBe(5);
  });

  it('Clamp constrains a value to [min, max]', async () => {
    expect((await run(Float.Clamp, { a: 5, b: 0, c: 10 })).result).toBe(5);
    expect((await run(Float.Clamp, { a: -1, b: 0, c: 10 })).result).toBe(0);
    expect((await run(Float.Clamp, { a: 99, b: 0, c: 10 })).result).toBe(10);
  });

  it('Min / Max', async () => {
    expect((await run(Float.Min, { a: 2.5, b: 9 })).result).toBe(2.5);
    expect((await run(Float.Max, { a: 2.5, b: 9 })).result).toBe(9);
  });

  it('Sign returns the sign of the value', async () => {
    expect((await run(Float.Sign, { a: -3.2 })).result).toBe(-1);
    expect((await run(Float.Sign, { a: 0 })).result).toBe(0);
    expect((await run(Float.Sign, { a: 3.2 })).result).toBe(1);
  });

  it('rounding operators', async () => {
    expect((await run(Float.Floor, { a: 2.9 })).result).toBe(2);
    expect((await run(Float.Ceil, { a: 2.1 })).result).toBe(3);
    expect((await run(Float.Round, { a: 2.5 })).result).toBe(3);
    expect((await run(Float.Trunc, { a: -2.9 })).result).toBe(-2);
  });

  it('degree / radian conversions are inverse', async () => {
    expect((await run(Float.DegreesToRadians, { a: 180 })).result).toBeCloseTo(
      Math.PI
    );
    expect(
      (await run(Float.RadiansToDegrees, { a: Math.PI })).result
    ).toBeCloseTo(180);
  });

  it('Equal and EqualTolerance', async () => {
    expect((await run(Float.Equal, { a: 0.3, b: 0.3 })).result).toBe(true);
    // classic floating point inequality
    expect((await run(Float.Equal, { a: 0.1 + 0.2, b: 0.3 })).result).toBe(
      false
    );
    // but equal within a tolerance
    expect(
      (await run(Float.EqualTolerance, { a: 0.1 + 0.2, b: 0.3, c: 0.0001 }))
        .result
    ).toBe(true);
  });

  it('comparison operators', async () => {
    expect((await run(Float.GreaterThan, { a: 2, b: 1 })).result).toBe(true);
    expect((await run(Float.GreaterThanOrEqual, { a: 2, b: 2 })).result).toBe(
      true
    );
    expect((await run(Float.LessThan, { a: 1, b: 2 })).result).toBe(true);
    expect((await run(Float.LessThanOrEqual, { a: 2, b: 2 })).result).toBe(
      true
    );
  });

  it('IsNaN and IsInf classify special values', async () => {
    expect((await run(Float.IsNaN, { a: NaN })).result).toBe(true);
    expect((await run(Float.IsNaN, { a: 1 })).result).toBe(false);
    expect((await run(Float.IsInf, { a: Infinity })).result).toBe(true);
    expect((await run(Float.IsInf, { a: NaN })).result).toBe(false);
    expect((await run(Float.IsInf, { a: 1 })).result).toBe(false);
  });

  it('constants expose E and PI', async () => {
    expect((await run(Float.E)).result).toBe(Math.E);
    expect((await run(Float.PI)).result).toBe(Math.PI);
  });
});
