import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {moveTile, outputTile, useShow} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import type {ItemId, SlideTile} from './model';
import type {TileKey} from './navigation';
import styles from './SlideGrid.module.css';

const tileKeys: Readonly<Record<string, TileKey>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
};

function useLiveIndex(itemId: ItemId | null): number | null {
  return useLive(view => {
    const slide = view.state?.layers.slide;
    return slide?.itemId === itemId ? slide.position : null;
  });
}

/** The accessible name: the number and the 이름표, a comma, and the first line. */
function tileName(number: number, {label, lines}: SlideTile): string {
  const heading = label ? `${number} ${label}` : `${number}`;
  const firstLine = lines[0];
  return firstLine ? `${heading}, ${firstLine}` : heading;
}

const Thumbnail = memo(
  ({
    tile,
    index,
    selected,
    live,
    onOutput,
  }: {
    readonly tile: SlideTile;
    readonly index: number;
    readonly selected: boolean;
    readonly live: boolean;
    readonly onOutput: (index: number) => void;
  }): JSX.Element => {
    const number = index + 1;
    return (
      <button
        type="button"
        role="option"
        tabIndex={selected ? 0 : -1}
        aria-selected={selected}
        aria-label={tileName(number, tile)}
        data-state={live ? 'live' : undefined}
        data-color={tile.labelColor === 'none' ? undefined : tile.labelColor}
        className={styles.thumb}
        onClick={() => onOutput(index)}
      >
        <span className={styles.canvas}>
          <span className={styles.text}>{tile.lines.join('\n')}</span>
        </span>
        <span className={styles.band}>
          <span className={styles.number}>{number}</span>
          <span className={styles.label}>{tile.label}</span>
        </span>
      </button>
    );
  },
);

/** The 장 grid of the open item. A click outputs a tile. */
export function SlideGrid({columns}: {readonly columns: number}): JSX.Element {
  const openItemId = useShow(view => view.openItemId);
  const selectedTile = useShow(view => view.selectedTile);
  const tiles = useShow(view =>
    view.openItemId === null ? undefined : view.tiles[view.openItemId],
  );
  const liveIndex = useLiveIndex(openItemId);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid?.contains(document.activeElement)) return;
    grid.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [selectedTile]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const key = tileKeys[event.key];
    if (key === undefined) return;
    event.preventDefault();
    moveTile(key, columns);
  };

  const onOutput = useCallback(
    (index: number): void => {
      if (openItemId !== null) outputTile({itemId: openItemId, index});
    },
    [openItemId],
  );

  return (
    <div
      ref={gridRef}
      role="listbox"
      aria-label="장"
      data-slide-grid=""
      className={styles.grid}
      style={{gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`}}
      onKeyDown={onKeyDown}
    >
      {tiles?.map((tile, index) => (
        <Thumbnail
          key={index}
          tile={tile}
          index={index}
          selected={index === selectedTile}
          live={index === liveIndex}
          onOutput={onOutput}
        />
      ))}
    </div>
  );
}
