import {useMemo, useState, type JSX} from 'react';
import {Panel, PanelBody, PanelHeader, PanelTitle} from '@renderer/ui/Panel';
import {TextField} from '@renderer/ui/TextField';
import {Section} from '@renderer/ui/gallery/Spec';
import {libraryFixture} from './fixture';
import {LibraryPanel} from './LibraryPanel';
import type {LibrarySelection} from './useLibrary';
import styles from './LibrarySection.module.css';

/** Interactive library specimen with an editor-title focus target. */
export function LibrarySection(): JSX.Element {
  const fixture = useMemo(() => libraryFixture(), []);
  const [selection, setSelection] = useState<LibrarySelection | null>(null);
  const [title, setTitle] = useState('');
  return (
    <Section title="Library">
      <div className={styles.columns}>
        <LibraryPanel
          api={fixture.api}
          onOpenSong={next => {
            setSelection(next);
            setTitle(next.document.song.title);
          }}
        />
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
    </Section>
  );
}
