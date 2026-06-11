import { Assert } from '../../../Diagnostics/Assert.js';
import { makeEventNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '@/Nodes/Registry/NodeCategory.js';

type State = {
  onStartEvent?: (() => void) | undefined;
};

const makeInitialState = (): State => ({
  onStartEvent: undefined
});

export const LifecycleOnStart = makeEventNodeDefinition({
  typeName: 'lifecycle/onStart',
  label: 'On Start',
  category: NodeCategory.Event,
  in: {},
  out: {
    flow: 'flow'
  },
  initialState: makeInitialState(),
  init: ({ state, commit, graph: { getDependency } }) => {
    Assert.mustBeTrue(state.onStartEvent === undefined);
    const onStartEvent = () => {
      commit('flow');
    };

    const lifecycleEventEmitter = getDependency('ILifecycleEventEmitter');

    lifecycleEventEmitter?.startEvent.addListener(onStartEvent);

    return {
      onStartEvent
    };
  },
  dispose: ({ state: { onStartEvent }, graph: { getDependency } }) => {
    const lifecycleEventEmitter = getDependency('ILifecycleEventEmitter');

    if (onStartEvent)
      lifecycleEventEmitter?.startEvent.removeListener(onStartEvent);

    return {};
  }
});
