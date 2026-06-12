import { describe, expect, it } from 'vitest';
import {
  generateTriggerTester,
  RecordedOutputType,
  type RecordedWritesOrCommits
} from '../../../testUtils.js';
import { DoN } from '@/Profiles/Core/Flow/DoN.js';

type RecordedWritesType = RecordedWritesOrCommits<typeof DoN.out>;

const fireWithCount = (count: number): RecordedWritesType => [
  { outputType: RecordedOutputType.write, socketName: 'count', value: count },
  { outputType: RecordedOutputType.commit, socketName: 'flow' }
];

describe('DoN', () => {
  it('writes the current count and commits to flow up to N times', () => {
    const trigger = generateTriggerTester(DoN);
    const inputVals = { n: 3n };

    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      fireWithCount(0)
    );
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      fireWithCount(1)
    );
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      fireWithCount(2)
    );
    // exhausted: 4th trigger does nothing
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toHaveLength(
      0
    );
  });

  it('resets the count when reset is triggered', () => {
    const trigger = generateTriggerTester(DoN);
    const inputVals = { n: 2n };

    trigger({ triggeringSocketName: 'flow', inputVals });
    trigger({ triggeringSocketName: 'flow', inputVals });
    // exhausted
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toHaveLength(
      0
    );

    expect(trigger({ triggeringSocketName: 'reset', inputVals })).toHaveLength(
      0
    );

    // fires again starting from count 0
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      fireWithCount(0)
    );
  });
});
