import {
  DefaultLogger,
  type IRegistry,
  ManualLifecycleEventEmitter,
  registerCoreProfile
} from '@kinforge/behave-graph';

import { useMemo } from 'react';

export const useRegistry = () => {
  return useMemo<IRegistry>(
    () =>
      registerCoreProfile({
        values: {},
        nodes: {},
        dependencies: {
          ILogger: new DefaultLogger(),
          ILifecycleEventEmitter: new ManualLifecycleEventEmitter()
        }
      }),
    []
  );
};
