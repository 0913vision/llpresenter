import type {JSX} from 'react';
import {defaultThumbnailColumns, type SizeClass} from '@renderer/ui/sizeClass';
import {useShow} from '@renderer/features/presentation/state/show';
import {
  isLibrarySource,
  shownTiles,
  useLiveTileIndex,
} from '@renderer/features/presentation/state/showLibrary';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from '@renderer/features/presentation/state/thumbnailScale';
import {Icon, ThumbnailSizeControl} from '@renderer/ui';
import {useTooltip} from '@renderer/ui/Tooltip';
import {SlideGrid} from './SlideGrid';
import {MISSING_BACKGROUND_TIP, READ_ONLY_TIP} from './problemReasons';
import styles from './SlidePanel.module.css';

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
  return (
    <SlideGrid
      columns={defaultThumbnailColumns[sizeClass]}
      scalePercent={useThumbnailScale(sizeClass)}
      onOpenPrep={onOpenPrep}
    />
  );
}

/**
 * The item name and the position in the header of the 장 panel: "2 / 9" when
 * the open item is the live one, and the 장 count otherwise.
 */
export function SlidePanelMeta(): JSX.Element | null {
  const openItemId = useShow(view => view.openItemId);
  const source = useShow(view =>
    isLibrarySource(view, openItemId) ? view.librarySong : null,
  );
  const reason =
    source?.problem === 'missing-background'
      ? MISSING_BACKGROUND_TIP
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
  const count = useShow(view => shownTiles(view)?.length ?? 0);
  const livePosition = useLiveTileIndex();
  if (title === undefined) return null;
  const position =
    livePosition === null
      ? `슬라이드 ${count}개`
      : `${livePosition + 1} / ${count}`;
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
        </>
      ) : null}
      <span className={styles.position}>{position}</span>
    </span>
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
