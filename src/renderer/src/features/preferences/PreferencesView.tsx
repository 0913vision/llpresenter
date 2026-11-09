import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useImperativeHandle,
  Activity,
  type Ref,
  type JSX,
} from 'react';
import type {PreferencesRequest} from '@contracts/ipc/window';
import {LoadReadiness, LoadReadinessContext} from '@renderer/ui/loadReadiness';
import {ListBox, ListRow} from '@renderer/ui';
import {Properties} from '@renderer/ui/PropertyRow';
import type {Notice} from '@renderer/ui/notices';
import {
  AboutPage,
  GeneralPage,
  ServiceOrderPage,
  MediaPage,
  OutputPage,
  StoragePage,
  preferencePages,
  type PreferencePageId,
} from './preferencePages';
import {BiblePage} from './BiblePage';
import {ShortcutsPage} from './shortcuts/ShortcutsPage';
import {useBibleEdits} from './useBibleEdits';
import {usePreferenceEdits} from './usePreferenceEdits';
import styles from './PreferencesView.module.css';
import {LabelsPage} from './LabelsPage';
import type {SongEditorStore} from '../songs/editor/songEditorStore';
import type {LabelManagerHandle} from '../songs/editor/LabelManager';

const NAV_LABEL = '환경설정 항목';
const noSubscribe = () => () => undefined;

interface PreferencesViewProps {
  readonly onProblem: (notice: Notice) => void;
  readonly onDismiss?: ((key: string) => void) | undefined;
  readonly labelStore?: SongEditorStore | undefined;
  readonly onReady?: ((request: PreferencesRequest) => void) | undefined;
  readonly request?: PreferencesRequest | undefined;
  readonly onPageSelect?: ((page: PreferencePageId) => void) | undefined;
  readonly viewRef?: Ref<PreferencesViewHandle> | undefined;
}

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
  request: controlledRequest,
  onPageSelect,
  viewRef,
}: PreferencesViewProps & {readonly readiness: LoadReadiness}): JSX.Element {
  const [localPage, setPage] = useState<PreferencePageId>('general');
  const page = controlledRequest?.page ?? localPage;
  const [shortcutsPrepared, setShortcutsPrepared] = useState(false);
  if (page === 'shortcuts' && !shortcutsPrepared) setShortcutsPrepared(true);
  const [localStarted, setStarted] = useState(false);
  const started = controlledRequest !== undefined || localStarted;
  const [pageRequest, setPageRequest] = useState(0);
  const pending = useSyncExternalStore(
    readiness.subscribe,
    readiness.getSnapshot,
  );
  const labelsLoaded = useSyncExternalStore(
    labelStore?.subscribe ?? noSubscribe,
    () =>
      labelStore?.getSnapshot().labels !== null ||
      labelStore.getSnapshot().labelsStatus === 'failed',
  );
  const [localRequest, setRequest] = useState<PreferencesRequest | null>(null);
  const request = controlledRequest ?? localRequest;
  const announced = useRef<PreferencesRequest | null>(null);
  const currentPage = useRef(page);
  const labelManager = useRef<LabelManagerHandle>(null);
  const requestedPage = useRef<PreferencePageId | null>(null);
  const settling = useRef(false);
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
  const requestPage = useCallback((next: PreferencePageId): void => {
    setPageRequest(value => value + 1);
    requestedPage.current = next;
    if (settling.current) return;
    const settle =
      currentPage.current === 'labels'
        ? labelManager.current?.settle
        : undefined;
    if (settle === undefined || next === currentPage.current) {
      currentPage.current = next;
      setPage(next);
      requestedPage.current = null;
      return;
    }
    settling.current = true;
    settle()
      .then(saved => {
        const target = requestedPage.current;
        if (saved && target !== null) {
          currentPage.current = target;
          setPage(target);
        }
      })
      .catch((error: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message:
            'Could not settle label drafts before changing preferences pages',
          detail: error instanceof Error ? error.message : String(error),
        }),
      )
      .finally(() => {
        settling.current = false;
        requestedPage.current = null;
      });
  }, []);
  // NOTE(0913vision): Main hands the start page over once, and StrictMode runs
  // the effect twice in a dev build, so the first answer is kept for the second
  // run instead of asking again.
  const start = useRef<Promise<PreferencePageId | null> | null>(null);
  useEffect(() => {
    if (controlledRequest !== undefined) {
      return undefined;
    }
    const api = window.llp?.window;
    if (api === undefined) return undefined;
    let stopped = false;
    let pushed = false;
    start.current ??= api.preferencesPage();
    start.current
      .then(first => {
        if (stopped) return;
        if (!pushed && first !== null) requestPage(first);
        setStarted(true);
      })
      .catch((error: unknown) => {
        if (!stopped) setStarted(true);
        window.llp?.log.write({
          level: 'error',
          message: 'Could not read the requested preferences page',
          detail: error instanceof Error ? error.message : String(error),
        });
      });
    const stop = api.onPreferencesPage(next => {
      pushed = true;
      requestPage(next);
    });
    return () => {
      stopped = true;
      requestedPage.current = null;
      stop();
    };
  }, [requestPage, controlledRequest]);
  useEffect(() => {
    const api = window.llp?.window;
    if (
      api === undefined ||
      onReady === undefined ||
      controlledRequest !== undefined
    ) {
      return undefined;
    }
    let active = true;
    api.preferencesRequest().then(
      value => {
        if (active) setRequest(value);
      },
      (error: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Could not read the preferences request identity',
          detail: error instanceof Error ? error.message : String(error),
        }),
    );
    return () => {
      active = false;
    };
  }, [pageRequest, onReady, controlledRequest]);
  const edits = usePreferenceEdits(onProblem);
  const loaded = pending === 0 && (page !== 'labels' || labelsLoaded);
  useEffect(() => {
    if (
      !started ||
      !loaded ||
      onReady === undefined ||
      request?.page !== page
    ) {
      return undefined;
    }
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
    document.fonts.ready.then(draw, (error: unknown) => {
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
  }, [started, loaded, onReady, pageRequest, page, request, readiness]);
  const bible = useBibleEdits(onProblem);
  const current = preferencePages.find(entry => entry.id === page);
  return (
    <div className={styles.view}>
      <nav className={styles.nav} aria-label={NAV_LABEL}>
        <ListBox
          label={NAV_LABEL}
          selected={page}
          onSelect={value => {
            const next = preferencePages.find(entry => entry.id === value);
            if (next !== undefined) {
              if (onPageSelect !== undefined) onPageSelect(next.id);
              else requestPage(next.id);
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
        {shortcutsPrepared ? (
          <Activity mode={page === 'shortcuts' ? 'visible' : 'hidden'}>
            <ShortcutsPage onProblem={onProblem} />
          </Activity>
        ) : null}
        <Properties
          placement="window"
          className={page === 'labels' ? styles.labels : undefined}
        >
          {page === 'general' ? <GeneralPage edits={edits} /> : null}
          {page === 'serviceOrder' ? <ServiceOrderPage edits={edits} /> : null}
          {page === 'output' ? <OutputPage edits={edits} /> : null}
          {page === 'storage' ? (
            <StoragePage
              edits={edits}
              onProblem={onProblem}
              onDismiss={onDismiss}
            />
          ) : null}
          {page === 'labels' ? (
            <LabelsPage store={labelStore} managerRef={labelManager} />
          ) : null}
          {page === 'about' ? <AboutPage /> : null}
          {page === 'media' ? <MediaPage edits={edits} /> : null}
          {page === 'bible' ? <BiblePage edits={edits} bible={bible} /> : null}
        </Properties>
      </section>
    </div>
  );
}
