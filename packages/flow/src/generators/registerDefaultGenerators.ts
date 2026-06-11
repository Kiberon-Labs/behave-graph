import type { System } from '@/system/system';
import { getSwitchOnStringGenerator } from '../generators/SwitchOnStringGenerator';
import { getSwitchOnIntegerGenerator } from '../generators/SwitchOnIntegerGenerator';
import { getCustomEventOnTriggeredGenerator } from '../generators/CustomEventOnTriggeredGenerator';
import { getSequenceGenerator } from '../generators/SequenceGenerator';

export function registerDefaultSocketGenerators(system: System): () => void {
  const store = system.socketGeneratorStore.getState();

  const switchOnString = getSwitchOnStringGenerator();
  store.registerGenerator(switchOnString);

  const switchOnInteger = getSwitchOnIntegerGenerator();
  store.registerGenerator(switchOnInteger);

  const customEventOnTriggered = getCustomEventOnTriggeredGenerator();
  store.registerGenerator(customEventOnTriggered);

  const sequence = getSequenceGenerator();
  store.registerGenerator(sequence);

  return () => {
    system.socketGeneratorStore
      .getState()
      .unregisterGenerator(switchOnString.name);
    system.socketGeneratorStore
      .getState()
      .unregisterGenerator(switchOnInteger.name);
    system.socketGeneratorStore
      .getState()
      .unregisterGenerator(customEventOnTriggered.name);
    system.socketGeneratorStore.getState().unregisterGenerator(sequence.name);
  };
}
