import { describe, expect, it } from 'vitest';
import {
  generateTriggerTester,
  RecordedOutputType,
  type RecordedWritesOrCommits
} from '../../../testUtils.js';
import { SwitchOnInteger } from '@/Profiles/Core/Flow/SwitchOnInteger.js';

type RecordedWritesType = RecordedWritesOrCommits<typeof SwitchOnInteger.out>;

const config = { numCases: 3, cases: {} };
// the case sockets are read as inputs; simulate their (default) values
const caseInputs = { 1: 1n, 2: 2n, 3: 3n };

const commit = (socketName: string): RecordedWritesType => [
  { outputType: RecordedOutputType.commit, socketName }
];

describe('SwitchOnInteger', () => {
  it('commits to the matching case output', () => {
    const trigger = generateTriggerTester(SwitchOnInteger, config);

    expect(
      trigger({
        triggeringSocketName: 'flow',
        inputVals: { ...caseInputs, selection: 2n }
      })
    ).toEqual(commit('2'));
  });

  it('commits to the first case when the selection matches it', () => {
    const trigger = generateTriggerTester(SwitchOnInteger, config);

    expect(
      trigger({
        triggeringSocketName: 'flow',
        inputVals: { ...caseInputs, selection: 1n }
      })
    ).toEqual(commit('1'));
  });

  it('commits to `default` when no case matches', () => {
    const trigger = generateTriggerTester(SwitchOnInteger, config);

    expect(
      trigger({
        triggeringSocketName: 'flow',
        inputVals: { ...caseInputs, selection: 99n }
      })
    ).toEqual(commit('default'));
  });
});
