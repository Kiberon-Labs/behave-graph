import { describe, expect, it } from 'vitest';
import {
  generateTriggerTester,
  RecordedOutputType,
  type RecordedWritesOrCommits
} from '../../../testUtils.js';
import { DoOnce } from '@/Profiles/Core/Flow/DoOnce.js';

type RecordedWritesType = RecordedWritesOrCommits<typeof DoOnce.out>;

const flowCommit: RecordedWritesType = [
  { outputType: RecordedOutputType.commit, socketName: 'flow' }
];

describe('DoOnce', () => {
  it('commits to flow only on the first trigger', () => {
    const trigger = generateTriggerTester(DoOnce);

    expect(trigger({ triggeringSocketName: 'flow' })).toEqual(flowCommit);
    expect(trigger({ triggeringSocketName: 'flow' })).toHaveLength(0);
    expect(trigger({ triggeringSocketName: 'flow' })).toHaveLength(0);
  });

  it('does nothing when reset is triggered', () => {
    const trigger = generateTriggerTester(DoOnce);

    expect(trigger({ triggeringSocketName: 'reset' })).toHaveLength(0);
  });

  it('fires again after a reset', () => {
    const trigger = generateTriggerTester(DoOnce);

    expect(trigger({ triggeringSocketName: 'flow' })).toEqual(flowCommit);
    expect(trigger({ triggeringSocketName: 'flow' })).toHaveLength(0);

    trigger({ triggeringSocketName: 'reset' });

    expect(trigger({ triggeringSocketName: 'flow' })).toEqual(flowCommit);
  });
});
