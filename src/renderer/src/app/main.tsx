import '@renderer/styles/base.css';
import {StrictMode, type ComponentType} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {startLiveSync} from '@renderer/session/live';
import {startServiceSync} from '@renderer/session/show';
import {seedSlideSurfaceView} from '@renderer/features/songs/editor/SlideSurfaceView';
import {seedThumbnailScale} from '@renderer/platform/thumbnailScale';
import {detailsScale} from '@renderer/platform/thumbnailScale';
import {
  createColumnWidthStore,
  loadUiState,
} from '@renderer/app/shell/loadColumnWidthStore';
import {App} from './App';
import {ControlSession} from './controlSession';

const root = document.getElementById('root');

interface WindowPageProps {
  readonly session: ControlSession;
  readonly closeFlush: ControlSession['closeFlush'];
}

interface WindowPage {
  readonly title: string;
  /** Starts what the page needs from the session before it renders. */
  readonly prepare?: (session: ControlSession) => void;
  readonly load: () => Promise<ComponentType<WindowPageProps>>;
}

const WINDOW_PAGES: Readonly<Record<string, WindowPage>> = {
  settings: {
    title: '환경설정',
    prepare: session => session.startEditor(),
    load: async () => (await import('./SettingsWindow')).SettingsWindow,
  },
  screens: {
    title: '화면 설정',
    load: async () => (await import('./ScreensWindow')).ScreensWindow,
  },
  preferences: {
    title: '환경설정',
    prepare: session => session.startEditor(),
    load: async () => (await import('./PreferencesWindow')).PreferencesWindow,
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
  page.prepare?.(pageSession);
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
      <Page session={pageSession} closeFlush={pageSession.closeFlush} />
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
  session.startEditor('manual');
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
  detailsScale.seed(uiState);
  seedSlideSurfaceView(uiState);
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
