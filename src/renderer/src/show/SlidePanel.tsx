import type {JSX} from 'react';
import {
  defaultThumbnailColumns,
  type SizeClass,
} from '@renderer/shell/sizeClass';
import {useLive} from '@renderer/state/live';
import {useShow} from '@renderer/state/show';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from '@renderer/state/thumbnailScale';
import {ThumbnailSizeControl} from '@renderer/ui';
import {SlideGrid} from './SlideGrid';
import styles from './SlidePanel.module.css';

/** The 슬라이드 grid at the size chosen for the current size class. */
export function SlidePanelBody({
  sizeClass,
}: {
  readonly sizeClass: SizeClass;
}): JSX.Element {
  return (
    <SlideGrid
      columns={defaultThumbnailColumns[sizeClass]}
      scalePercent={useThumbnailScale(sizeClass)}
    />
  );
}

/**
 * The item name and the position in the header of the 장 panel: "2 / 9" when
 * the open item is the live one, and the 장 count otherwise.
 */
export function SlidePanelMeta(): JSX.Element | null {
  const openItemId = useShow(view => view.openItemId);
  const title = useShow(
    view => view.rows.find(row => row.id === openItemId)?.title,
  );
  const count = useShow(view =>
    openItemId === null ? 0 : (view.tiles[openItemId]?.length ?? 0),
  );
  const livePosition = useLive(view => {
    const slide = view.state?.layers.slide;
    return slide?.itemId === openItemId ? slide.position : null;
  });
  if (title === undefined) return null;
  const position =
    livePosition === null
      ? `슬라이드 ${count}개`
      : `${livePosition + 1} / ${count}`;
  return (
    <span className={styles.meta}>
      <span className={styles.name}>{title}</span>
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
