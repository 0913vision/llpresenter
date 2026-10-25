import {useCallback, useEffect, useRef, type JSX} from 'react';
import {outputTile, selectTile, useShow} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {SlideThumbnail, ThumbnailGrid} from '@renderer/ui';
import type {ItemId} from './model';
import {useKeptFocus} from './useKeptFocus';
import styles from './SlideGrid.module.css';

function useLiveIndex(itemId: ItemId | null): number | null {
  return useLive(view => {
    const slide = view.state?.layers.slide;
    return slide?.itemId === itemId ? slide.position : null;
  });
}

/** The 장 grid of the open item. A click outputs a tile. */
export function SlideGrid({columns}: {readonly columns: number}): JSX.Element {
  const openItemId = useShow(view => view.openItemId);
  const selectedTile = useShow(view => view.selectedTile);
  const tiles = useShow(view =>
    view.openItemId === null ? undefined : view.tiles[view.openItemId],
  );
  const liveIndex = useLiveIndex(openItemId);
  const keeperRef = useRef<HTMLDivElement>(null);
  const {isInside, onFocus, onBlur} = useKeptFocus(keeperRef);

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
          />
        ))}
      </ThumbnailGrid>
    </div>
  );
}
