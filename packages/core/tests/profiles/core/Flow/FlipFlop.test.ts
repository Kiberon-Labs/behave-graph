import { describe, expect, it } from 'vitest';
import {
  generateTriggerTester,
  RecordedOutputType,
  type RecordedWritesOrCommits
} from '../../../testUtils.js';
import { FlipFlop } from '@/Profiles/Core/Flow/FlipFlop.js';

type RecordedWritesType = RecordedWritesOrCommits<typeof FlipFlop.out>;

describe('FlipFlop', () => {
  it('alternates between the `on` and `off` flows, writing isOn', () => {
    const trigger = generateTriggerTester(FlipFlop);

    // starts on
    const first = trigger({ triggeringSocketName: 'flow' });
    expect(first).toEqual<RecordedWritesType>([
      { outputType: RecordedOutputType.write, socketName: 'isOn', value: true },
      { outputType: RecordedOutputType.commit, socketName: 'on' }
    ]);

    // then off
    const second = trigger({ triggeringSocketName: 'flow' });
    expect(second).toEqual<RecordedWritesType>([
      { outputType: RecordedOutputType.write, socketName: 'isOn', value: false },
      { outputType: RecordedOutputType.commit, socketName: 'off' }
    ]);

    // then on again
    const third = trigger({ triggeringSocketName: 'flow' });
    expect(third).toEqual<RecordedWritesType>([
      { outputType: RecordedOutputType.write, socketName: 'isOn', value: true },
      { outputType: RecordedOutputType.commit, socketName: 'on' }
    ]);
  });
});
