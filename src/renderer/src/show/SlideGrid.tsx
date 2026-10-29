import {useCallback, useEffect, useRef, type JSX} from 'react';
import {outputTile, selectTile, useShow} from '@renderer/state/show';
import {shownTiles, useLiveTileIndex} from '@renderer/state/showLibrary';
import {SlideThumbnail, ThumbnailGrid, thumbnailWidth} from '@renderer/ui';
import {useGridMeasure} from './useGridMeasure';
import {useKeptFocus} from './useKeptFocus';
import styles from './SlideGrid.module.css';

const GRID_SELECTOR = '[role="listbox"]';

export interface SlideGridProps {
  /** The columns of the size class at 100%: 3, 4, or 6. */
  readonly columns: number;
  /** The 슬라이드 size in percent, 50 to 200. */
  readonly scalePercent: number;
}

/** The 슬라이드 grid of the open item. A click outputs a tile. */
export function SlideGrid({
  columns,
  scalePercent,
}: SlideGridProps): JSX.Element {
  const openItemId = useShow(view => view.openItemId);
  const selectedTile = useShow(view => view.selectedTile);
  const tiles = useShow(shownTiles);
  const liveIndex = useLiveTileIndex();
  const keeperRef = useRef<HTMLDivElement>(null);
  const {isInside, onFocus, onBlur} = useKeptFocus(keeperRef);
  const {width, gap} = useGridMeasure(keeperRef, GRID_SELECTOR);
  const tileWidth = thumbnailWidth({
    gridWidth: width,
    columns,
    gap,
    scalePercent,
  });

  useEffect(() => {
    if (!isInside()) return;
    keeperRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [isInside, openItemId, selectedTile, tiles?.length]);

  const onOutput = useCallback(
    (index: number): void => {
      if (openItemId !== null) outputTile({itemId: openItemId, index});
    },
    [openItemId],
  );

  return (
    <div
      ref={keeperRef}
      className={styles.keeper}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <ThumbnailGrid
        workspace="show"
        label="슬라이드"
        columns={columns}
        tileWidth={tileWidth}
        selected={tiles === undefined ? undefined : selectedTile}
        onSelect={selectTile}
        onOutput={onOutput}
        className={styles.grid}
      >
        {tiles?.map((tile, index) => (
          <SlideThumbnail
            key={index}
            number={index + 1}
            label={tile.label ?? undefined}
            labelColor={tile.labelColor}
            text={tile.lines.join('\n')}
            selected={index === selectedTile}
            live={index === liveIndex}
            hotKey={tile.hotKey}
          />
        ))}
      </ThumbnailGrid>
    </div>
  );
}
