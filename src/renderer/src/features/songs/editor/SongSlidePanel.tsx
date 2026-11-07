import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useSyncExternalStore, type JSX} from 'react';
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from '@renderer/platform/thumbnailScale';
import {defaultThumbnailColumns, type SizeClass} from '@renderer/ui/sizeClass';
import type {EditorLabels, SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import {VirtualSlides} from './VirtualSlides';
import styles from './SongPanels.module.css';

export interface SongSlideStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => {
    readonly session: SongSession | null;
    readonly labels?: EditorLabels | null | undefined;
    readonly busy?: boolean;
  };
}

/** File/arrangement thumbnails select editor blocks without outputting. */
export function SongSlidePanel({
  store,
  sizeClass,
}: {
  readonly store: SongEditorStore | SongSlideStore;
  readonly sizeClass: SizeClass;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const scale = useThumbnailScale(sizeClass);
  const session = state.session;
  if (session === null) {
    return (
      <Panel label="슬라이드">
        <PanelHeader>
          <PanelTitle title="슬라이드" />
        </PanelHeader>
      </Panel>
    );
  }
  const {song} = session.history.snapshot;
  const numbers = song.slides.map((_, index) => index + 1);
  const at = session.selectedOccurrence;
  const select = (index: number): void => {
    session.selectOccurrence(index);
  };
  return (
    <Panel label="슬라이드" className={styles.panel}>
      <PanelHeader>
        <PanelTitle title="슬라이드" />
      </PanelHeader>
      <PanelBody variant="flush">
        <VirtualSlides
          key={song.id}
          song={song}
          numbers={numbers}
          labels={state.labels?.value.labels ?? []}
          selected={at < 0 ? undefined : at}
          baseline={defaultThumbnailColumns[sizeClass]}
          scale={scale}
          onSelect={select}
          onEdit={select}
          onHotKey={
            'requestAction' in store
              ? index => {
                  const number = numbers[index];
                  if (number === undefined) return;
                  select(index);
                  store.requestAction('hot-key');
                }
              : undefined
          }
          hotKeyReason={
            session.blocked
              ? '저장 오류'
              : session.readOnly
                ? NEWER_FILE_REASON
                : state.busy
                  ? '작업을 마친 뒤 다시 시도하세요'
                  : undefined
          }
        />
      </PanelBody>
      <PanelFooter
        count={numbers.length}
        end={
          <ThumbnailSizeControl
            value={scale}
            onChange={value => showThumbnailScale(sizeClass, value)}
            onCommit={value => saveThumbnailScale(sizeClass, value)}
          />
        }
      />
    </Panel>
  );
}
