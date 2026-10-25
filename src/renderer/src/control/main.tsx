import '@renderer/styles/base.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {startLiveSync} from '@renderer/state/live';
import {startServiceSync} from '@renderer/state/show';
import {seedThumbnailScale} from '@renderer/state/thumbnailScale';
import {
  createColumnWidthStore,
  loadUiState,
} from '@renderer/shell/loadColumnWidthStore';
import {App} from './App';
import {ControlSession} from './controlSession';

const root = document.getElementById('root');

async function start(container: HTMLElement): Promise<void> {
  const stopLive = startLiveSync();
  const stopService = startServiceSync();
  const session = new ControlSession(window.llp);
  const uiState = await loadUiState(window.llp);
  seedThumbnailScale(uiState);
  const columnWidthStore = createColumnWidthStore(window.llp, uiState);
  const reactRoot = createRoot(container);
  window.addEventListener(
    'pagehide',
    () => {
      reactRoot.unmount();
      stopLive();
      stopService();
      session.dispose().catch((error: unknown) => console.error(error));
    },
    {once: true},
  );
  reactRoot.render(
    <StrictMode>
      <App
        columnWidthStore={columnWidthStore}
        session={session}
        uiState={uiState}
      />
    </StrictMode>,
  );
}

if (root !== null) {
  start(root).catch((error: unknown) => console.error(error));
}
