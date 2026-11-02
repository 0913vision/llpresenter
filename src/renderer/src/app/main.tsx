import '@renderer/styles/base.css';
import {StrictMode, type ComponentType} from 'react';
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

const root = document.getElementById('root');

interface WindowPageProps {
  readonly closeFlush: ControlSession['closeFlush'];
}

interface WindowPage {
  readonly title: string;
  readonly load: () => Promise<ComponentType<WindowPageProps>>;
}

const WINDOW_PAGES: Readonly<Record<string, WindowPage>> = {
  screens: {
    title: '화면 설정',
    load: async () => (await import('./ScreensWindow')).ScreensWindow,
  },
  order: {
    title: '순서 편집',
    load: async () => (await import('./OrderEditorWindow')).OrderEditorWindow,
  },
  song: {
    title: '곡 편집',
    load: async () => (await import('./SongEditorWindow')).SongEditorWindow,
  },
};

function windowPageOf(search: string): WindowPage | undefined {
  const name = new URLSearchParams(search).get('window');
  return name !== null && Object.hasOwn(WINDOW_PAGES, name)
    ? WINDOW_PAGES[name]
    : undefined;
}

async function startWindowPage(
  container: HTMLElement,
  page: WindowPage,
  stopLive: () => void,
): Promise<void> {
  const pageSession = new ControlSession(window.llp);
  document.title = page.title;
  const pageRoot = createRoot(container);
  const lifecycle = {stopped: false};
  window.addEventListener(
    'pagehide',
    () => {
      lifecycle.stopped = true;
      pageRoot.unmount();
      stopLive();
      pageSession.dispose().catch((error: unknown) => console.error(error));
    },
    {once: true},
  );
  const Page = await page.load();
  if (lifecycle.stopped) return;
  pageRoot.render(
    <StrictMode>
      <Page closeFlush={pageSession.closeFlush} />
    </StrictMode>,
  );
}

async function start(container: HTMLElement): Promise<void> {
  const stopLive = startLiveSync();
  const page = windowPageOf(window.location.search);
  if (page !== undefined) {
    await startWindowPage(container, page, stopLive);
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
