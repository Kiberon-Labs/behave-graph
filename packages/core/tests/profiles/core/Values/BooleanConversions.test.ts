import { describe, expect, it } from 'vitest';
import { testExec } from '../../../testUtils.js';
import { toInteger } from '@/Profiles/Core/Values/BooleanNodes.js';
import { toBoolean as intToBoolean } from '@/Profiles/Core/Values/IntegerNodes.js';

describe('Boolean Conversions', () => {
  describe('math/toBoolean/integer', () => {
    it('writes to the output false when the input value is 0', async () => {
      const outputs = await testExec({
        exec: intToBoolean.exec,
        nodeInputVals: {
          a: 0n
        }
      });

      expect(outputs['result']).toEqual(false);
    });
    it('writes to the output true when the input value is non-zero', async () => {
      const outputs = await testExec({
        exec: intToBoolean.exec,
        // test with value 1
        nodeInputVals: {
          a: 1n
        }
      });
      expect(outputs['result']).toEqual(true);

      const secondResult = await testExec({
        exec: intToBoolean.exec,
        // test with value to 5
        nodeInputVals: {
          a: 5n
        }
      });

      expect(secondResult['result']).toEqual(true);
    });
  });

  describe('math/toInteger/boolean', () => {
    it('writes to the output 1 when the input value is true', async () => {
      const output = await testExec({
        exec: toInteger.exec,
        nodeInputVals: {
          a: true
        }
      });
      expect(output['result']).toEqual(1n);
    });
    it('writes to the output 0 when the input value is false', async () => {
      const output = await testExec({
        exec: toInteger.exec,
        nodeInputVals: { a: false }
      });
      expect(output['result']).toEqual(0n);
    });
  });
});
