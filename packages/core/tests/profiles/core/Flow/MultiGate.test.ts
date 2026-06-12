import { describe, expect, it } from 'vitest';
import {
  generateTriggerTester,
  RecordedOutputType,
  type RecordedWritesOrCommits
} from '../../../testUtils.js';
import { MultiGate } from '@/Profiles/Core/Flow/MultiGate.js';

type RecordedWritesType = RecordedWritesOrCommits<typeof MultiGate.out>;

const commit = (socketName: string): RecordedWritesType => [
  { outputType: RecordedOutputType.commit, socketName }
];

describe('MultiGate', () => {
  it('commits to each output socket in sequence', () => {
    const trigger = generateTriggerTester(MultiGate);
    const inputVals = { startIndex: 0n, loop: false };

    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      commit('1')
    );
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      commit('2')
    );
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      commit('3')
    );
  });

  it('stops committing once it runs out of outputs when not looping', () => {
    const trigger = generateTriggerTester(MultiGate);
    const inputVals = { startIndex: 0n, loop: false };

    trigger({ triggeringSocketName: 'flow', inputVals });
    trigger({ triggeringSocketName: 'flow', inputVals });
    trigger({ triggeringSocketName: 'flow', inputVals });

    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toHaveLength(
      0
    );
  });

  it('wraps back to the first output when loop is enabled', () => {
    const trigger = generateTriggerTester(MultiGate);
    const inputVals = { startIndex: 0n, loop: true };

    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      commit('1')
    );
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      commit('2')
    );
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      commit('3')
    );
    // wraps around
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      commit('1')
    );
  });

  it('honours a non-zero start index', () => {
    const trigger = generateTriggerTester(MultiGate);
    const inputVals = { startIndex: 1n, loop: false };

    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      commit('2')
    );
    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      commit('3')
    );
  });

  it('resets back to the first output', () => {
    const trigger = generateTriggerTester(MultiGate);
    const inputVals = { startIndex: 0n, loop: false };

    trigger({ triggeringSocketName: 'flow', inputVals });
    trigger({ triggeringSocketName: 'flow', inputVals });

    expect(trigger({ triggeringSocketName: 'reset', inputVals })).toHaveLength(
      0
    );

    expect(trigger({ triggeringSocketName: 'flow', inputVals })).toEqual(
      commit('1')
    );
  });
});
