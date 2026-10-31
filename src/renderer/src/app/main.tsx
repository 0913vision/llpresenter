import '@renderer/styles/base.css';
import {StrictMode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {startLiveSync} from '@renderer/session/live';
import {startServiceSync} from '@renderer/session/show';
import {seedThumbnailScale} from '@renderer/platform/thumbnailScale';
import {
  createColumnWidthStore,
  loadUiState,
} from '@renderer/app/shell/loadColumnWidthStore';
import {App} from './App';
import {ControlSession} from './controlSession';
import {ScreensWindow} from './ScreensWindow';

const root = document.getElementById('root');

async function start(container: HTMLElement): Promise<void> {
  const stopLive = startLiveSync();
  if (new URLSearchParams(window.location.search).get('window') === 'screens') {
    document.title = '화면 설정';
    const screenRoot = createRoot(container);
    window.addEventListener(
      'pagehide',
      () => {
        screenRoot.unmount();
        stopLive();
      },
      {once: true},
    );
    screenRoot.render(
      <StrictMode>
        <ScreensWindow />
      </StrictMode>,
    );
    return;
  }
  const stopService = startServiceSync();
  const session = new ControlSession(window.llp);
  const lifecycle: {stopped: boolean; root?: Root} = {stopped: false};
  window.addEventListener(
    'pagehide',
    () => {
      lifecycle.stopped = true;
      lifecycle.root?.unmount();
      stopLive();
      stopService();
      session.dispose().catch((error: unknown) => console.error(error));
    },
    {once: true},
  );
  const uiState = await loadUiState(window.llp);
  if (lifecycle.stopped) return;
  seedThumbnailScale(uiState);
  const columnWidthStore = createColumnWidthStore(window.llp, uiState);
  lifecycle.root = createRoot(container);
  lifecycle.root.render(
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
