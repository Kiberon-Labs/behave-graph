import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { Flow, SystemProvider, System, LayoutController } from '@kinforge/behave-graph-flow';
import { useRegistry } from './hooks/useRegistry';
import { DefaultLogger, ManualLifecycleEventEmitter, registerCoreProfile } from '@kinforge/behave-graph';


const registry = registerCoreProfile({
  values: {},
  nodes: {},
  dependencies: {
    ILogger: new DefaultLogger(),
    ILifecycleEventEmitter: new ManualLifecycleEventEmitter()
  }
})

const system = new System(registry);

const Inner = () => {

  return <SystemProvider value={system}>
    <LayoutController />
  </SystemProvider>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div id="graph-editor">
      <Inner />
    </div>
  </React.StrictMode>,
);
