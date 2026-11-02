import {useCallback, useEffect, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SongDocument} from '@core/schema/contentDocuments';
import type {Label} from '@core/schema/labels';
import type {
  OrderEditorTarget,
  SongEditorTarget,
} from '@core/schema/ipcPayloads';
import type {ServiceItemOf} from '@core/schema/service';
import {ARRANGEMENT_LIMIT_REASON} from '@core/songs/songArrangements';
import {playedGroupIds, playedOrderWithLimit} from '@core/songs/itemOrder';
import {NEWER_FILE_REASON} from '@renderer/features/service/items/ItemArrangement';
import type {ItemProblem} from '@renderer/features/service/items/itemEditQueue';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {Button} from '@renderer/ui/Button';
import {Slider} from '@renderer/ui/Slider';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {useOverlayControl} from '@renderer/features/service/items/useOverlayControl';
import {useOverlayEditing} from '@renderer/features/service/items/useOverlayEditing';
import {OrderRows} from './OrderRows';
import {OrderSlides} from './OrderSlides';
import {orderTiles} from './orderEditorModel';
import {useOrderEdits} from './useOrderEdits';
import {openSongEditorWindow} from './openWindows';
import styles from './OrderEditor.module.css';

/** The slide tile width, in CSS pixels, before the operator picks one. */
export const DEFAULT_SLIDE_SIZE = 240;
export const MIN_SLIDE_SIZE = 120;
export const MAX_SLIDE_SIZE = 480;

type EditorApi = Pick<
  LlpApi,
  'orderEditor' | 'content' | 'services' | 'window' | 'settings' | 'media'
>;

export interface OrderEditorProps {
  readonly api: EditorApi;
  readonly target: OrderEditorTarget;
  readonly item: ServiceItemOf<'song'>;
  readonly document: SongDocument;
  /** Whether the 예배 순서 file is read-only. */
  readonly serviceReadOnly: boolean;
  readonly labels: readonly Label[];
  readonly onProblem: (notice: Notice) => void;
  readonly reloadSong: () => void;
}

function useSlideSize(api: Pick<LlpApi, 'orderEditor'>) {
  const [size, setSize] = useState(DEFAULT_SLIDE_SIZE);
  useEffect(() => {
    let alive = true;
    api.orderEditor.slideSize().then(
      saved => {
        if (alive && saved !== null) setSize(saved);
      },
      (error: unknown) => console.error('Could not read the slide size', error),
    );
    return () => {
      alive = false;
    };
  }, [api]);
  return {
    size,
    show: setSize,
    keep: (value: number): void => api.orderEditor.setSlideSize(value),
  };
}

function problemNotice(
  title: string,
  retry: (() => unknown) | undefined,
  retryLabel: string | undefined,
): Notice {
  return {
    key: `order-editor:${title}`,
    kind: 'warning',
    icon: 'warning',
    title,
    time: noticeTime(),
    ...(retry === undefined
      ? {}
      : {
          actions: [
            {
              icon: 'refresh',
              label: retryLabel ?? '다시 시도',
              onSelect: retry,
            },
          ],
        }),
  };
}

/** The 순서 편집 window's body for one song item. */
export function OrderEditor({
  api,
  target,
  item,
  document,
  serviceReadOnly,
  labels,
  onProblem,
  reloadSong,
}: OrderEditorProps): JSX.Element {
  const {song} = document;
  const [selectedTile, setSelectedTile] = useState<number | undefined>();
  const slideSize = useSlideSize(api);
  const reportProblem = useCallback<ItemProblem>(
    (title, retry, retryLabel) =>
      onProblem(problemNotice(title, retry, retryLabel)),
    [onProblem],
  );
  const edits = useOrderEdits({
    api,
    target,
    document,
    onProblem: reportProblem,
    reloadSong,
  });
  const openSong = (spot: Pick<SongEditorTarget, 'block' | 'action'>): void => {
    editorTask(
      openSongEditorWindow(api, {songId: document.song.id, ...spot}, onProblem),
    );
  };
  const order = playedGroupIds(song, item);
  const capped = playedOrderWithLimit(song, item).capped;
  const tiles = capped ? [] : orderTiles(song, order, labels);
  const locked = serviceReadOnly || document.access === 'readOnly';
  const lockedReason = locked
    ? NEWER_FILE_REASON
    : capped
      ? ARRANGEMENT_LIMIT_REASON
      : undefined;
  const {editing} = useOverlayEditing({
    api,
    item,
    count: tiles.length,
    reason: lockedReason ?? (edits.busy ? '저장 중' : undefined),
    change: edits.changeOverlays,
  });
  const overlays = useOverlayControl(editing);
  const shown =
    selectedTile === undefined
      ? undefined
      : Math.min(selectedTile, tiles.length - 1);
  return (
    <div className={styles.editor}>
      <header className={styles.header}>
        <h1 className={styles.title}>{document.song.title}</h1>
        <Button icon="edit" onClick={() => openSong({})}>
          곡 편집…
        </Button>
      </header>
      <OrderRows
        song={song}
        labels={labels}
        order={order}
        arrangement={
          song.arrangements?.some(entry => entry.name === item.arrangement) ===
          true
            ? item.arrangement
            : undefined
        }
        selected={shown === undefined ? undefined : tiles[shown]?.chip}
        onSelect={chip =>
          setSelectedTile(tiles.findIndex(tile => tile.chip === chip))
        }
        edits={edits}
        locked={locked || capped}
        lockedReason={lockedReason}
        onEditSong={action => openSong({action})}
      />
      <OrderSlides
        tiles={tiles}
        selected={shown}
        onSelect={setSelectedTile}
        tileWidth={slideSize.size}
        overlays={overlays}
        onEditSong={block => openSong({block})}
      />
      <footer className={styles.footer}>
        <span>슬라이드 {tiles.length}개</span>
        <Slider
          label="슬라이드 크기"
          icon="grid"
          min={MIN_SLIDE_SIZE}
          max={MAX_SLIDE_SIZE}
          step="any"
          value={slideSize.size}
          onChange={slideSize.show}
          onCommit={value => slideSize.keep(Math.round(value))}
        />
      </footer>
    </div>
  );
}
