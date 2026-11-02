import type {JSX} from 'react';
import {Button} from '@renderer/ui/Button';
import {SongEditor} from './SongEditor';
import {SongPreviewPanel} from './SongPreview';
import {SongSaveDialogs} from './SongSaveDialogs';
import type {SongEditorStore} from './songEditorStore';
import type {SongEditorWindowModel} from './useSongEditorWindow';
import styles from './SongWindowLayout.module.css';

const NO_EDITS = '변경한 내용 없음';

/** The 곡 편집 window's body: lyrics on the left, preview and saving on the right. */
export function SongWindowLayout({
  store,
  model,
}: {
  readonly store: SongEditorStore;
  readonly model: SongEditorWindowModel;
}): JSX.Element {
  const {session, saving} = model;
  const unsaved = session?.unsaved === true;
  return (
    <div className={styles.layout}>
      <div className={styles.lyrics}>
        <SongEditor store={store} unsaved={unsaved} />
      </div>
      <div className={styles.side}>
        <SongPreviewPanel store={store} />
        <div className={styles.saveBar}>
          <Button
            disabled={session === null || saving}
            onClick={model.askSaveAs}
          >
            다른 이름으로 저장…
          </Button>
          <Button
            variant="primary"
            disabled={!unsaved || saving}
            title={unsaved ? undefined : NO_EDITS}
            onClick={model.askOverwrite}
          >
            저장
          </Button>
        </div>
      </div>
      <SongSaveDialogs model={model} />
    </div>
  );
}
