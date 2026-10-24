import '@renderer/styles/base.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {startLiveSync} from '@renderer/state/live';
import {App} from './App';

const root = document.getElementById('root');
if (root !== null) {
  startLiveSync();
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
