import {useState, useSyncExternalStore, type JSX} from 'react';
import {
  Panel,
  PanelActions,
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
import type {AnySong} from '@core/schema/groupedSong';
import {VirtualSlides} from './VirtualSlides';
import {ARRANGEMENT_LIMIT_REASON} from '@core/songs/songArrangements';
import {StatusDot} from '@renderer/ui/StatusMarks';
import styles from './SongPanels.module.css';
import {isGroupedSong} from '@core/schema/groupedSong';

export interface SongSlideStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => {
    readonly session: SongSession<AnySong> | null;
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
  const [pointed, setPointed] = useState<{
    songId: string;
    order: string | undefined;
    index: number;
  } | null>(null);
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
  const {song, selection} = session.history.snapshot;
  const {slides: numbers, capped} = session.arrangementOrder;
  const at =
    pointed !== null &&
    pointed.songId === song.id &&
    pointed.order === session.arrangement &&
    numbers[pointed.index] === selection.block + 1
      ? pointed.index
      : numbers.indexOf(selection.block + 1);
  const select = (index: number): void => {
    const number = numbers[index];
    if (number === undefined) return;
    setPointed({songId: song.id, order: session.arrangement, index});
    session.select({block: number - 1, start: 0, end: 0});
  };
  return (
    <Panel label="슬라이드" className={styles.panel}>
      <PanelHeader>
        <PanelTitle
          title="슬라이드"
          meta={capped ? '한도 초과' : String(numbers.length)}
        />
        {capped ? (
          <PanelActions>
            <span
              role="status"
              aria-label={ARRANGEMENT_LIMIT_REASON}
              title={ARRANGEMENT_LIMIT_REASON}
            >
              <StatusDot tone="warning" />
            </span>
          </PanelActions>
        ) : null}
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
            'requestAction' in store && isGroupedSong(song)
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
              ? '저장 오류 해결 필요'
              : session.readOnly
                ? '읽기 전용 곡입니다'
                : state.busy
                  ? '작업을 마친 뒤 다시 시도하세요'
                  : undefined
          }
        />
      </PanelBody>
      <PanelFooter
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
