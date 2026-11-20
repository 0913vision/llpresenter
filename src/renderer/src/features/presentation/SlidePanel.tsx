import {useSyncExternalStore, type JSX} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {defaultThumbnailColumns, type SizeClass} from '@renderer/ui/sizeClass';
import {useShow} from '@renderer/session/show';
import {
  isLibrarySource,
  projectedLiveCursor,
  shownTilesFor,
  tilesForView,
  useLiveTileIndex,
} from '@renderer/session/showLibrary';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from '@renderer/platform/thumbnailScale';
import {Button, Icon, ThumbnailSizeControl} from '@renderer/ui';
import {missingBackgroundTip} from '@renderer/features/media/backgroundChoices';
import {openSongEditorWindow} from '@renderer/features/songs/editor/openWindow';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {Notice} from '@renderer/ui/notices';
import {PanelFooter} from '@renderer/ui/Panel';
import {useTooltip} from '@renderer/ui/Tooltip';
import {SlideGrid} from './SlideGrid';
import {ContinuousSlideGrid} from './ContinuousSlideGrid';
import {liveReturn} from './liveReturn';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {READ_ONLY_TIP} from '../../platform/problemReasons';
import styles from './SlidePanel.module.css';
import {useVisibleSlideItem} from '@renderer/session/visibleSlideItem';
import {useShownItemId} from '@renderer/session/shownItem';
import {useLive} from '@renderer/session/live';

const PROBLEM_ICON_SIZE = 14;

/** The 슬라이드 grid at the size chosen for the current size class. */
export function SlidePanelBody({
  sizeClass,
  onOpenPrep,
}: {
  readonly sizeClass: SizeClass;
  readonly onOpenPrep?:
    ((itemId: string, position?: number) => void) | undefined;
}): JSX.Element {
  const settings = useSettingsDocument('preferences', '환경설정', undefined);
  const scalePercent = useThumbnailScale(sizeClass);
  const shownItemId = useShownItemId();
  const isServiceItem = useShow(
    view =>
      shownItemId === null || view.rows.some(row => row.id === shownItemId),
  );
  const Grid =
    settings?.value.show?.continuousGrid && isServiceItem
      ? ContinuousSlideGrid
      : SlideGrid;
  return (
    <Grid
      columns={defaultThumbnailColumns[sizeClass]}
      scalePercent={scalePercent}
      onOpenPrep={onOpenPrep}
    />
  );
}

/**
 * The item name and, for the live item, its current slide position.
 */
export function SlidePanelMeta({
  onProblem = console.error,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const visibleItemId = useVisibleSlideItem();
  const continuous = useSyncExternalStore(liveReturn.subscribe, liveReturn.get);
  const slide = useLive(view => view.state?.layers.slide ?? null);
  const liveCursor = useShow(
    useShallow(view => {
      if (continuous === 'none') return null;
      const cursor = projectedLiveCursor(view, slide);
      return cursor !== null && view.rows.some(row => row.id === cursor.itemId)
        ? cursor
        : null;
    }),
  );
  const openItemId = liveCursor?.itemId ?? visibleItemId;
  const source = useShow(view =>
    isLibrarySource(view, openItemId) ? view.librarySong : null,
  );
  const reason =
    source?.problem === 'missing-background'
      ? missingBackgroundTip(source.missingBackgroundName)
      : source?.readOnly
        ? READ_ONLY_TIP
        : undefined;
  const {targetProps, tooltip} = useTooltip(
    reason ? {text: reason} : undefined,
  );
  const title = useShow(view =>
    isLibrarySource(view, openItemId)
      ? view.librarySong.title
      : view.rows.find(row => row.id === openItemId)?.title,
  );
  const count = useShow(view =>
    openItemId === null ? 0 : tilesForView(view, openItemId).length,
  );
  const selectedLivePosition = useLiveTileIndex();
  const livePosition =
    continuous === 'none' ? selectedLivePosition : (liveCursor?.index ?? null);
  if (title === undefined) return null;
  const position =
    livePosition === null ? undefined : `${livePosition + 1} / ${count}`;
  return (
    <span className={styles.meta}>
      <span className={styles.name}>{title}</span>
      {reason ? (
        <>
          <span
            {...targetProps}
            role="img"
            aria-label={reason}
            className={styles.warning}
          >
            <Icon name="warning" size={PROBLEM_ICON_SIZE} />
          </span>
          {tooltip}
          {source?.problem === 'missing-background' ? (
            <Button
              size="sm"
              disabled={source.readOnly || window.llp === undefined}
              onClick={() => {
                const api = window.llp;
                if (api === undefined) return;
                editorTask(
                  openSongEditorWindow({songId: source.songId}, onProblem),
                );
              }}
            >
              배경 바꾸기
            </Button>
          ) : null}
        </>
      ) : null}
      {position === undefined ? null : (
        <span className={styles.position}>{position}</span>
      )}
    </span>
  );
}

export function SlidePanelFooter({
  sizeClass,
}: {
  readonly sizeClass: SizeClass;
}): JSX.Element {
  const shownItemId = useShownItemId();
  const count = useShow(view => shownTilesFor(view, shownItemId)?.length ?? 0);
  const live = useSyncExternalStore(liveReturn.subscribe, liveReturn.get);
  return (
    <PanelFooter
      count={count}
      end={
        <>
          {live === 'none' ? null : (
            <Button
              size="sm"
              disabled={live !== 'away'}
              onClick={() => liveReturn.go()}
            >
              {'현 위치로'}
            </Button>
          )}
          <SlideSizeControl sizeClass={sizeClass} />
        </>
      }
    />
  );
}

/**
 * The 슬라이드 size control in the footer of the 슬라이드 panel: the grid
 * follows a drag at once, and the finished size is saved for the size class.
 */
export function SlideSizeControl({
  sizeClass,
}: {
  readonly sizeClass: SizeClass;
}): JSX.Element {
  // NOTE(0913vision): The control is new for each size class, so a % draft
  // typed in one size class is dropped, not saved to the next one.
  return (
    <ThumbnailSizeControl
      key={sizeClass}
      workspace="show"
      compact={sizeClass === 'narrow'}
      value={useThumbnailScale(sizeClass)}
      onChange={percent => showThumbnailScale(sizeClass, percent)}
      onCommit={percent => saveThumbnailScale(sizeClass, percent)}
    />
  );
}
