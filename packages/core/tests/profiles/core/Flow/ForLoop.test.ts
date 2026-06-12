import { describe, expect, it } from 'vitest';
import {
  generateTriggerTester,
  RecordedOutputType,
  type RecordedWritesOrCommits
} from '../../../testUtils.js';
import { ForLoop } from '@/Profiles/Core/Flow/ForLoop.js';

type RecordedWritesType = RecordedWritesOrCommits<typeof ForLoop.out>;

describe('ForLoop', () => {
  it('writes the index and commits the loop body for each iteration then completes', () => {
    const trigger = generateTriggerTester(ForLoop);

    const outputs = trigger({
      triggeringSocketName: 'flow',
      inputVals: { startIndex: 0n, endIndex: 3n }
    });

    const expected: RecordedWritesType = [
      { outputType: RecordedOutputType.write, socketName: 'index', value: 0n },
      { outputType: RecordedOutputType.commit, socketName: 'loopBody' },
      { outputType: RecordedOutputType.write, socketName: 'index', value: 1n },
      { outputType: RecordedOutputType.commit, socketName: 'loopBody' },
      { outputType: RecordedOutputType.write, socketName: 'index', value: 2n },
      { outputType: RecordedOutputType.commit, socketName: 'loopBody' },
      { outputType: RecordedOutputType.commit, socketName: 'completed' }
    ];

    expect(outputs).toEqual(expected);
  });

  it('runs from a non-zero start index', () => {
    const trigger = generateTriggerTester(ForLoop);

    const outputs = trigger({
      triggeringSocketName: 'flow',
      inputVals: { startIndex: 2n, endIndex: 4n }
    });

    expect(outputs).toEqual<RecordedWritesType>([
      { outputType: RecordedOutputType.write, socketName: 'index', value: 2n },
      { outputType: RecordedOutputType.commit, socketName: 'loopBody' },
      { outputType: RecordedOutputType.write, socketName: 'index', value: 3n },
      { outputType: RecordedOutputType.commit, socketName: 'loopBody' },
      { outputType: RecordedOutputType.commit, socketName: 'completed' }
    ]);
  });

  it('immediately completes when the range is empty', () => {
    const trigger = generateTriggerTester(ForLoop);

    const outputs = trigger({
      triggeringSocketName: 'flow',
      inputVals: { startIndex: 5n, endIndex: 5n }
    });

    expect(outputs).toEqual<RecordedWritesType>([
      { outputType: RecordedOutputType.commit, socketName: 'completed' }
    ]);
  });
});
