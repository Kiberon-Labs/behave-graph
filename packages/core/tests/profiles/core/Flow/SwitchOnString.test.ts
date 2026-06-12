import { describe, expect, it } from 'vitest';
import {
  generateTriggerTester,
  RecordedOutputType,
  type RecordedWritesOrCommits
} from '../../../testUtils.js';
import { SwitchOnString } from '@/Profiles/Core/Flow/SwitchOnString.js';

type RecordedWritesType = RecordedWritesOrCommits<typeof SwitchOnString.out>;

const config = { numCases: 3, cases: {} };
const caseInputs = { 1: 'red', 2: 'green', 3: 'blue' };

const commit = (socketName: string): RecordedWritesType => [
  { outputType: RecordedOutputType.commit, socketName }
];

describe('SwitchOnString', () => {
  it('commits to the matching case output', () => {
    const trigger = generateTriggerTester(SwitchOnString, config);

    expect(
      trigger({
        triggeringSocketName: 'flow',
        inputVals: { ...caseInputs, selection: 'green' }
      })
    ).toEqual(commit('2'));
  });

  it('commits to `default` when no case matches', () => {
    const trigger = generateTriggerTester(SwitchOnString, config);

    expect(
      trigger({
        triggeringSocketName: 'flow',
        inputVals: { ...caseInputs, selection: 'purple' }
      })
    ).toEqual(commit('default'));
  });
});
