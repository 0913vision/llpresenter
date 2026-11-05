import {useCallback, useEffect, useRef, useState, type JSX} from 'react';
import {ListBox, ListRow} from '@renderer/ui';
import {Properties} from '@renderer/ui/PropertyRow';
import type {Notice} from '@renderer/ui/notices';
import {
  AboutPage,
  GeneralPage,
  LibraryPage,
  MediaPage,
  OutputPage,
  preferencePages,
  type PreferencePageId,
} from './preferencePages';
import {BiblePage} from './BiblePage';
import {ImportPage} from './ImportPage';
import {ShortcutsPage} from './shortcuts/ShortcutsPage';
import {useBibleEdits} from './useBibleEdits';
import {usePreferenceEdits} from './usePreferenceEdits';
import styles from './PreferencesView.module.css';
import {LabelsPage} from './LabelsPage';
import type {SongEditorStore} from '../songs/editor/songEditorStore';
import type {LabelManagerHandle} from '../songs/editor/LabelManager';

const NAV_LABEL = '환경설정 항목';

/** The page list and the open page of the 환경설정 window. */
export function PreferencesView({
  onProblem,
  labelStore,
}: {
  readonly onProblem: (notice: Notice) => void;
  readonly labelStore?: SongEditorStore | undefined;
}): JSX.Element {
  const [page, setPage] = useState<PreferencePageId>('general');
  const currentPage = useRef(page);
  const labelManager = useRef<LabelManagerHandle>(null);
  const requestedPage = useRef<PreferencePageId | null>(null);
  const settling = useRef(false);
  const requestPage = useCallback((next: PreferencePageId): void => {
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
    const api = window.llp?.window;
    if (api === undefined) return undefined;
    let stopped = false;
    start.current ??= api.preferencesPage();
    start.current
      .then(first => {
        if (!stopped && first !== null) requestPage(first);
      })
      .catch((error: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Could not read the requested preferences page',
          detail: error instanceof Error ? error.message : String(error),
        }),
      );
    const stop = api.onPreferencesPage(requestPage);
    return () => {
      stopped = true;
      requestedPage.current = null;
      stop();
    };
  }, [requestPage]);
  const edits = usePreferenceEdits(onProblem);
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
            if (next !== undefined) requestPage(next.id);
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
        {page === 'shortcuts' ? (
          <ShortcutsPage onProblem={onProblem} />
        ) : (
          <h1 className={styles.title}>{current?.label}</h1>
        )}
        <Properties placement="window">
          {page === 'general' ? <GeneralPage edits={edits} /> : null}
          {page === 'output' ? <OutputPage edits={edits} /> : null}
          {page === 'library' ? (
            <LibraryPage edits={edits} onProblem={onProblem} />
          ) : null}
          {page === 'labels' ? (
            <LabelsPage store={labelStore} managerRef={labelManager} />
          ) : null}
          {page === 'about' ? <AboutPage /> : null}
          {page === 'media' ? <MediaPage edits={edits} /> : null}
          {page === 'bible' ? <BiblePage edits={edits} bible={bible} /> : null}
          {page === 'import' ? <ImportPage edits={edits} /> : null}
        </Properties>
      </section>
    </div>
  );
}
