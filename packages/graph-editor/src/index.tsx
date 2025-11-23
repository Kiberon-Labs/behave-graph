
import './styles.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { LayoutController } from './components/layoutController';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <LayoutController />
  </React.StrictMode>
);
