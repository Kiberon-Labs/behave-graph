import {
  DefaultLogger,
  type IRegistry,
  ManualLifecycleEventEmitter,
  registerCoreProfile
} from '@kiberon-labs/behave-graph';
import {
  DummyScene,
  registerSceneProfile
} from '@kiberon-labs/behave-graph-scene';
import { useMemo } from 'react';

export const useRegistry = () => {
  return useMemo<IRegistry>(
    () =>
      registerSceneProfile(
        registerCoreProfile({
          values: {},
          nodes: {},
          dependencies: {
            ILogger: new DefaultLogger(),
            ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
            IScene: new DummyScene()
          }
        })
      ),
    []
  );
};
