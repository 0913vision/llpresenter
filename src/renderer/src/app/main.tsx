import '@renderer/styles/base.css';
import {StrictMode, type ComponentType} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {startLiveSync} from '@renderer/session/live';
import {startOpenServiceSync} from '@renderer/session/openService';
import {startServiceSync} from '@renderer/session/show';
import {seedSlideColumns} from '@renderer/features/slides/slideColumns';
import {seedSlideSurfaceView} from '@renderer/features/slides/SlideSurfaceView';
import {
  renameDraftLabel,
  startSongDraftSync,
} from '@renderer/features/songs/songDraft';
import {startMediaSync} from '@renderer/platform/media';
import {startThemesSync} from '@renderer/platform/themes';
import {
  seedThumbnailScale,
  detailsScale,
} from '@renderer/platform/thumbnailScale';
import {seedPreview} from '@renderer/session/preview';
import {seedShowToolTab} from '@renderer/features/tools/showToolTab';
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
  readonly load: () => Promise<ComponentType<WindowPageProps>>;
}

const WINDOW_PAGES: Readonly<Record<string, WindowPage>> = {
  settings: {
    title: '환경설정',
    load: async () => (await import('./SettingsWindow')).SettingsWindow,
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
      pageSession.dispose();
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
  const stopThemes = startThemesSync(window.llp);
  const stopMedia = startMediaSync(window.llp);
  const page = windowPageOf(window.location.search);
  if (page !== undefined) {
    await startWindowPage(container, page, () => {
      stopLive();
      stopThemes();
      stopMedia();
    });
    return;
  }
  const stopService = startServiceSync();
  const stopOpenService = startOpenServiceSync();
  const session = new ControlSession(window.llp);
  const stopSong = startSongDraftSync(window.llp, session.report);
  const stopLabels = session.labels?.onRenamed(renameDraftLabel);
  const lifecycle: {stopped: boolean; root?: Root} = {stopped: false};
  window.addEventListener(
    'pagehide',
    () => {
      lifecycle.stopped = true;
      lifecycle.root?.unmount();
      stopLive();
      stopThemes();
      stopMedia();
      stopService();
      stopOpenService();
      stopSong();
      stopLabels?.();
      session.dispose();
    },
    {once: true},
  );
  const uiState = await loadUiState(window.llp);
  if (lifecycle.stopped) return;
  seedThumbnailScale(uiState);
  seedPreview(uiState);
  seedShowToolTab(uiState);
  detailsScale.seed(uiState);
  seedSlideSurfaceView(uiState);
  seedSlideColumns(uiState);
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
