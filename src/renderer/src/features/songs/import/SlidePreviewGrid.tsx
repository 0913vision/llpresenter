import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from 'react';
import type {ShowTile} from '@core/schema/showService';
import {TilePicture, tileProps} from '@renderer/pictures/TilePicture';
import {SlideThumbnail} from '@renderer/ui/tiles/SlideThumbnail';
import styles from './SlidePreviewGrid.module.css';

const COLUMNS = 3;
const OVERSCAN = 1;
const INITIAL_ROWS = 3;

interface Measure {
  readonly width: number;
  readonly height: number;
  readonly gap: number;
  readonly band: number;
  /** The room around the tiles, for their outlines. */
  readonly inset: number;
}
const EMPTY: Measure = {width: 0, height: 0, gap: 0, band: 0, inset: 0};

/** The slides of an import as they will be, drawing only the rows in view. */
export function SlidePreviewGrid({
  tiles,
  numberOf,
  isSelected,
  onSelect,
}: {
  readonly tiles: readonly ShowTile[];
  readonly numberOf: (index: number) => number;
  readonly isSelected: (index: number) => boolean;
  readonly onSelect: (index: number, shift: boolean) => void;
}): JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  const [measure, setMeasure] = useState(EMPTY);
  const [scrollTop, setScrollTop] = useState(0);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (node === null) return undefined;
    const read = (): void => {
      const css = getComputedStyle(node);
      const px = (name: string): number =>
        parseFloat(css.getPropertyValue(name)) || 0;
      setMeasure({
        width: node.clientWidth,
        height: node.clientHeight,
        gap: px('--space-16'),
        band: px('--size-thumb-band'),
        inset: px('--space-4'),
      });
    };
    const observer = new ResizeObserver(read);
    observer.observe(node);
    read();
    return () => observer.disconnect();
  }, []);
  const tileWidth = Math.max(
    0,
    (measure.width - measure.inset * 2 - measure.gap * (COLUMNS - 1)) / COLUMNS,
  );
  const stride =
    tileWidth > 0 ? (tileWidth * 9) / 16 + measure.band + measure.gap : 1;
  const rows = Math.ceil(tiles.length / COLUMNS);
  const visible =
    measure.height > 0 ? Math.ceil(measure.height / stride) : INITIAL_ROWS;
  const first = Math.max(
    0,
    Math.min(
      Math.floor(scrollTop / stride) - OVERSCAN,
      Math.max(0, rows - visible),
    ),
  );
  const begin = first * COLUMNS;
  const finish = Math.min(
    tiles.length,
    (first + visible + OVERSCAN * 2) * COLUMNS,
  );
  const offset: CSSProperties = {top: first * stride + measure.inset};
  return (
    <div
      ref={viewport}
      className={styles.viewport}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div
        className={styles.spacer}
        style={{height: rows * stride + measure.inset}}
      >
        <div className={styles.grid} style={offset}>
          {tiles.slice(begin, finish).map((tile, local) => {
            const index = begin + local;
            return (
              <div
                key={index}
                className={styles.tile}
                onClick={event => onSelect(index, event.shiftKey)}
              >
                <SlideThumbnail
                  {...tileProps(tile)}
                  number={numberOf(index)}
                  canvas={<TilePicture tile={tile} tiles={tiles} />}
                  selected={isSelected(index)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
