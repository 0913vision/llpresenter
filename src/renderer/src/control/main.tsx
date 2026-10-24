import '@renderer/styles/base.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {startLiveSync} from '@renderer/state/live';
import {seedThumbnailColumns, startServiceSync} from '@renderer/state/show';
import {
  createColumnWidthStore,
  loadUiState,
} from '@renderer/shell/loadColumnWidthStore';
import {App} from './App';

const root = document.getElementById('root');

async function start(container: HTMLElement): Promise<void> {
  startLiveSync();
  startServiceSync();
  const uiState = await loadUiState(window.llp);
  seedThumbnailColumns(uiState);
  const columnWidthStore = createColumnWidthStore(window.llp, uiState);
  createRoot(container).render(
    <StrictMode>
      <App columnWidthStore={columnWidthStore} />
    </StrictMode>,
  );
}

if (root !== null) {
  start(root).catch((error: unknown) => console.error(error));
}
