import type {ChangeEvent, JSX} from 'react';
import type {SizeClass} from '@renderer/shell/sizeClass';
import {useLive} from '@renderer/state/live';
import {
  MAX_THUMBNAIL_COLUMNS,
  MIN_THUMBNAIL_COLUMNS,
  setThumbnailColumns,
  useShow,
  useThumbnailColumns,
} from '@renderer/state/show';
import {SlideGrid} from './SlideGrid';
import styles from './SlidePanel.module.css';

const SLIDER_SUM = MIN_THUMBNAIL_COLUMNS + MAX_THUMBNAIL_COLUMNS;

/** The 장 grid with the columns of the current size class. */
export function SlidePanelBody({
  sizeClass,
}: {
  readonly sizeClass: SizeClass;
}): JSX.Element {
  return <SlideGrid columns={useThumbnailColumns(sizeClass)} />;
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
    livePosition === null ? `${count}장` : `${livePosition + 1} / ${count}`;
  return (
    <span className={styles.meta}>
      <span className={styles.name}>{title}</span>
      <span className={styles.position}>{position}</span>
    </span>
  );
}

/**
 * The thumbnail size slider in the footer of the 장 panel. Moving it right
 * makes the thumbnails larger, so it shows fewer columns.
 */
export function ThumbnailSizeSlider({
  sizeClass,
}: {
  readonly sizeClass: SizeClass;
}): JSX.Element {
  const columns = useThumbnailColumns(sizeClass);
  const onChange = (event: ChangeEvent<HTMLInputElement>): void =>
    setThumbnailColumns(
      sizeClass,
      SLIDER_SUM - event.currentTarget.valueAsNumber,
    );
  return (
    <input
      type="range"
      aria-label="썸네일 크기"
      className={styles.slider}
      min={MIN_THUMBNAIL_COLUMNS}
      max={MAX_THUMBNAIL_COLUMNS}
      step={1}
      value={SLIDER_SUM - columns}
      onChange={onChange}
    />
  );
}
