import { describe, expect, it } from 'vitest';
import {
  generateTriggerTester,
  RecordedOutputType,
  type RecordedWritesOrCommits
} from '../../../testUtils.js';
import { Branch } from '@/Profiles/Core/Flow/Branch.js';

type RecordedWritesType = RecordedWritesOrCommits<typeof Branch.out>;

describe('Branch', () => {
  it('commits to the `true` flow when the condition is true', () => {
    const trigger = generateTriggerTester(Branch);

    const outputs = trigger({
      triggeringSocketName: 'flow',
      inputVals: { condition: true }
    });

    const expected: RecordedWritesType = [
      { outputType: RecordedOutputType.commit, socketName: 'true' }
    ];
    expect(outputs).toEqual(expected);
  });

  it('commits to the `false` flow when the condition is false', () => {
    const trigger = generateTriggerTester(Branch);

    const outputs = trigger({
      triggeringSocketName: 'flow',
      inputVals: { condition: false }
    });

    const expected: RecordedWritesType = [
      { outputType: RecordedOutputType.commit, socketName: 'false' }
    ];
    expect(outputs).toEqual(expected);
  });

  it('treats a missing/undefined condition as false', () => {
    const trigger = generateTriggerTester(Branch);

    const outputs = trigger({ triggeringSocketName: 'flow' });

    const expected: RecordedWritesType = [
      { outputType: RecordedOutputType.commit, socketName: 'false' }
    ];
    expect(outputs).toEqual(expected);
  });
});
