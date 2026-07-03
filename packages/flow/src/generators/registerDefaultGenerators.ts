import type { System } from '@/system/system';
import { getSwitchOnStringGenerator } from '../generators/SwitchOnStringGenerator';
import { getSwitchOnIntegerGenerator } from '../generators/SwitchOnIntegerGenerator';
import { getCustomEventOnTriggeredGenerator } from '../generators/CustomEventOnTriggeredGenerator';
import { getSequenceGenerator } from '../generators/SequenceGenerator';
import {
  getGraphInputGenerator,
  getGraphOutputGenerator
} from '../generators/GraphBoundaryGenerator';
import { getCallSubgraphGenerator } from '../generators/CallSubgraphGenerator';

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

  const graphInput = getGraphInputGenerator();
  store.registerGenerator(graphInput);

  const graphOutput = getGraphOutputGenerator();
  store.registerGenerator(graphOutput);

  const callSubgraph = getCallSubgraphGenerator();
  store.registerGenerator(callSubgraph);

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
    system.socketGeneratorStore.getState().unregisterGenerator(graphInput.name);
    system.socketGeneratorStore
      .getState()
      .unregisterGenerator(graphOutput.name);
    system.socketGeneratorStore
      .getState()
      .unregisterGenerator(callSubgraph.name);
  };
}
