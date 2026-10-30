import {useCallback, useMemo, useState, type JSX} from 'react';
import {NotificationStack} from '@renderer/ui/Notification';
import {addNotice, removeNotice, type Notice} from '@renderer/ui/notices';
import {Panel, PanelBody, PanelHeader, PanelTitle} from '@renderer/ui/Panel';
import {TextField} from '@renderer/ui/TextField';
import {Section} from '@renderer/gallery/Spec';
import {libraryFixture} from './fixture';
import {LibraryPanel} from './LibraryPanel';
import type {LibraryApi, LibrarySelection} from './useLibrary';
import styles from './LibrarySection.module.css';

/** Demonstrates the workspace host's shared notices and editor-title focus. */
export function LibraryGalleryHost({
  api,
}: {
  readonly api: LibraryApi;
}): JSX.Element {
  const [selection, setSelection] = useState<LibrarySelection | null>(null);
  const [title, setTitle] = useState('');
  const [notices, setNotices] = useState<readonly Notice[]>([]);
  const [warningHeight, setWarningHeight] = useState(0);
  const onProblem = useCallback((notice: Notice) => {
    const actions = notice.actions?.map(action => ({
      ...action,
      onSelect: () => {
        setNotices(current => removeNotice(current, notice.key));
        action.onSelect();
      },
    }));
    setNotices(current => addNotice(current, {...notice, actions}));
  }, []);
  return (
    <>
      <div className={styles.columns}>
        <LibraryPanel
          api={api}
          onProblem={onProblem}
          onOpenSong={next => {
            setSelection(next);
            setTitle(next.document.song.title);
          }}
        />
        <div
          className={styles.editor}
          style={{
            paddingTop:
              warningHeight === 0
                ? 0
                : `calc(${warningHeight}px + var(--panel-gap))`,
          }}
        >
          {selection ? (
            <Panel label="곡 제목">
              <PanelHeader>
                <PanelTitle title={selection.document.song.title} />
              </PanelHeader>
              <PanelBody>
                <TextField
                  key={selection.document.song.id}
                  aria-label="곡 제목"
                  variant="title"
                  autoFocus={selection.focusTitle}
                  value={title}
                  onChange={setTitle}
                />
              </PanelBody>
            </Panel>
          ) : null}
        </div>
      </div>
      <NotificationStack
        notices={notices}
        onClose={key => setNotices(current => removeNotice(current, key))}
        onWarningHeightChange={setWarningHeight}
      />
    </>
  );
}

/** Interactive library specimen with an editor-title focus target. */
export function LibrarySection(): JSX.Element {
  const fixture = useMemo(() => libraryFixture(), []);
  return (
    <Section title="Library">
      <LibraryGalleryHost api={fixture.api} />
    </Section>
  );
}
