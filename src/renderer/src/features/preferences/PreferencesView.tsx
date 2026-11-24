import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useImperativeHandle,
  type Ref,
  type JSX,
} from 'react';
import type {PreferencesRequest} from '@contracts/ipc/window';
import {LoadReadiness, LoadReadinessContext} from '@renderer/ui/loadReadiness';
import {ListRow} from '@renderer/ui/lists/ListRow';
import {Properties} from '@renderer/ui/panels/PropertyRow';
import type {Notice} from '@renderer/ui/popups/notices';
import {
  AboutPage,
  GeneralPage,
  ServiceOrderPage,
  ShowPage,
  MediaPage,
  OutputPage,
  PrepPage,
  StoragePage,
  preferencePages,
  type PreferencePageId,
} from './preferencePages';
import {useLibraryLocations} from './useLibraryLocations';
import {BiblePage} from './BiblePage';
import {ShortcutsPage} from './shortcuts/ShortcutsPage';
import {useBibleEdits} from './useBibleEdits';
import {usePreferenceEdits} from './usePreferenceEdits';
import {useAudioOutputs} from './useAudioOutputs';
import styles from './PreferencesView.module.css';
import {LabelsPage} from '../labels/LabelsPage';
import type {LabelCatalog} from '../labels/labelCatalog';
import type {LabelManagerHandle} from '../labels/LabelManager';
import {ListBox} from '@renderer/ui/lists/ListBox';

const NAV_LABEL = '환경설정 항목';
const FIRST_PAGE: PreferencePageId = 'general';
const noSubscribe = () => () => undefined;
function preferencesFontsReady(): Promise<unknown> {
  try {
    return document.fonts.ready;
  } catch {
    return Promise.resolve();
  }
}

interface PreferencesViewProps {
  readonly onProblem: (notice: Notice) => void;
  readonly onDismiss?: ((key: string) => void) | undefined;
  readonly labelStore?: LabelCatalog | undefined;
  /** What the settings window asks for; none before it asks. */
  readonly request: PreferencesRequest | undefined;
  /** Told once the page that is asked for has drawn. */
  readonly onReady: (request: PreferencesRequest) => void;
  readonly onPageSelect: (page: PreferencePageId) => void;
  readonly viewRef?: Ref<PreferencesViewHandle> | undefined;
}

/**
 * What the owner of the 환경설정 view can ask of it: `settle` finishes the edits
 * still under way and resolves false when one could not be saved.
 */
export interface PreferencesViewHandle {
  settle(): Promise<boolean>;
}

/** The page list and the open page of the 환경설정 window. */
export function PreferencesView(props: PreferencesViewProps): JSX.Element {
  const [readiness] = useState(() => new LoadReadiness());
  return (
    <LoadReadinessContext value={readiness}>
      <PreferencesContent {...props} readiness={readiness} />
    </LoadReadinessContext>
  );
}

function PreferencesContent({
  onProblem,
  onDismiss,
  labelStore,
  onReady,
  readiness,
  request,
  onPageSelect,
  viewRef,
}: PreferencesViewProps & {readonly readiness: LoadReadiness}): JSX.Element {
  const audioOutputs = useAudioOutputs();
  const page = request?.page ?? FIRST_PAGE;
  const pending = useSyncExternalStore(
    readiness.subscribe,
    readiness.getSnapshot,
  );
  const labelsLoaded = useSyncExternalStore(
    labelStore?.subscribe ?? noSubscribe,
    () =>
      labelStore?.getSnapshot().labels !== null ||
      labelStore.getSnapshot().status === 'failed',
  );
  const announced = useRef<PreferencesRequest | null>(null);
  const labelManager = useRef<LabelManagerHandle>(null);
  const stopPendingPage = useRef<(() => void) | null>(null);
  useEffect(() => () => stopPendingPage.current?.(), []);
  useImperativeHandle(
    viewRef,
    () => ({
      settle: async () => {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement) focused.blur();
        return page === 'labels'
          ? ((await labelManager.current?.settle()) ?? true)
          : true;
      },
    }),
    [page],
  );
  const edits = usePreferenceEdits(onProblem);
  const locations = useLibraryLocations(onProblem, onDismiss);
  const loaded = pending === 0 && (page !== 'labels' || labelsLoaded);
  useEffect(() => {
    if (request === undefined || !loaded) return undefined;
    let stopped = false;
    const draw = (): void => {
      if (
        stopped ||
        readiness.getSnapshot() !== 0 ||
        (announced.current?.requestId === request.requestId &&
          announced.current.page === request.page)
      ) {
        return;
      }
      announced.current = request;
      onReady(request);
    };
    const fontsReady = preferencesFontsReady();
    fontsReady.then(draw, (error: unknown) => {
      window.llp?.log.write({
        level: 'error',
        message: 'Could not prepare preferences fonts',
        detail: error instanceof Error ? error.message : String(error),
      });
      draw();
    });
    return () => {
      stopped = true;
    };
  }, [loaded, onReady, request, readiness, pending]);
  const bible = useBibleEdits(onProblem);
  const current = preferencePages.find(entry => entry.id === page);
  const choosePage = (next: PreferencePageId): void => {
    stopPendingPage.current?.();
    stopPendingPage.current = null;
    const select = (): void => {
      stopPendingPage.current?.();
      stopPendingPage.current = null;
      onPageSelect(next);
    };
    if (readiness.getSnapshot() === 0 || next === page) {
      select();
      return;
    }
    stopPendingPage.current = readiness.subscribe(() => {
      if (readiness.getSnapshot() === 0) select();
    });
  };
  return (
    <div className={styles.view}>
      <nav className={styles.nav} aria-label={NAV_LABEL}>
        <ListBox
          label={NAV_LABEL}
          selected={page}
          onSelect={value => {
            const next = preferencePages.find(entry => entry.id === value);
            if (next !== undefined) {
              choosePage(next.id);
            }
          }}
        >
          {preferencePages.map(entry => (
            <ListRow
              key={entry.id}
              value={entry.id}
              title={entry.label}
              icon={entry.icon}
            />
          ))}
        </ListBox>
      </nav>
      <section className={styles.page} aria-label={current?.label}>
        {page === 'shortcuts' ? null : (
          <h1 className={styles.title}>{current?.label}</h1>
        )}
        <div hidden={page !== 'shortcuts'}>
          <ShortcutsPage onProblem={onProblem} />
        </div>
        <Properties
          placement="window"
          className={page === 'labels' ? styles.labels : undefined}
        >
          {page === 'general' ? <GeneralPage edits={edits} /> : null}
          {page === 'show' ? <ShowPage edits={edits} /> : null}
          {page === 'serviceOrder' ? <ServiceOrderPage edits={edits} /> : null}
          {page === 'output' ? <OutputPage edits={edits} /> : null}
          {page === 'prep' ? <PrepPage edits={edits} /> : null}
          {page === 'storage' ? (
            <StoragePage edits={edits} locations={locations} />
          ) : null}
          {page === 'labels' ? (
            <LabelsPage store={labelStore} managerRef={labelManager} />
          ) : null}
          <div hidden={page !== 'about'}>
            <AboutPage />
          </div>
          {page === 'media' ? (
            <MediaPage edits={edits} audioOutputs={audioOutputs} />
          ) : null}
          {page === 'bible' ? <BiblePage edits={edits} bible={bible} /> : null}
        </Properties>
      </section>
    </div>
  );
}
