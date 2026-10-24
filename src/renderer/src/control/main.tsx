import '@renderer/styles/base.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {startLiveSync} from '@renderer/state/live';
import {loadColumnWidthStore} from '@renderer/shell/loadColumnWidthStore';
import {App} from './App';

const root = document.getElementById('root');

async function start(container: HTMLElement): Promise<void> {
  startLiveSync();
  const columnWidthStore = await loadColumnWidthStore(window.llp);
  createRoot(container).render(
    <StrictMode>
      <App columnWidthStore={columnWidthStore} />
    </StrictMode>,
  );
}

if (root !== null) {
  start(root).catch((error: unknown) => console.error(error));
}
