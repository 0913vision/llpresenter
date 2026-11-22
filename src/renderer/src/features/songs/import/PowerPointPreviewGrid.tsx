import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from 'react';
import type {PowerPointSource} from '@core/schema/powerpointImport';
import {SlidePicture} from '@renderer/pictures/SlidePicture';
import type {SlideInput} from '@renderer/rendering/slideStillSpec';
import {SlideThumbnail} from '@renderer/ui/SlideThumbnail';
import styles from './PowerPointImport.module.css';

const COLUMNS = 3;
const OVERSCAN = 1;
const INITIAL_ROWS = 3;

interface Measure {
  readonly width: number;
  readonly height: number;
  readonly gap: number;
  readonly band: number;
}
const EMPTY: Measure = {width: 0, height: 0, gap: 0, band: 0};

/** Draws only the rows in view. */
export function PowerPointPreviewGrid({
  slides,
  pictures,
  start,
  end,
  onSelect,
}: {
  readonly slides: PowerPointSource['slides'];
  readonly pictures: readonly SlideInput[];
  readonly start: number;
  readonly end: number;
  readonly onSelect: (index: number, shift: boolean) => void;
}): JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  const [measure, setMeasure] = useState(EMPTY);
  const [scrollTop, setScrollTop] = useState(0);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const read = (): void => {
      const css = getComputedStyle(node);
      const px = (name: string): number =>
        parseFloat(css.getPropertyValue(name)) || 0;
      setMeasure({
        width: node.clientWidth,
        height: node.clientHeight,
        gap: px('--space-16'),
        band: px('--size-thumb-band'),
      });
    };
    const observer = new ResizeObserver(read);
    observer.observe(node);
    read();
    return () => observer.disconnect();
  }, []);
  const tileWidth = Math.max(
    0,
    (measure.width - measure.gap * (COLUMNS - 1)) / COLUMNS,
  );
  const stride =
    tileWidth > 0 ? (tileWidth * 9) / 16 + measure.band + measure.gap : 1;
  const rows = Math.ceil(slides.length / COLUMNS);
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
    slides.length,
    (first + visible + OVERSCAN * 2) * COLUMNS,
  );
  const offset: CSSProperties = {top: first * stride};
  return (
    <div
      ref={viewport}
      className={styles.gridViewport}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className={styles.gridSpacer} style={{height: rows * stride}}>
        <div className={styles.grid} style={offset}>
          {slides.slice(begin, finish).map((slide, local) => {
            const index = begin + local;
            const picture = pictures[index];
            const lines = picture?.slide.lines;
            return (
              <div
                key={slide.number}
                className={styles.tile}
                onClick={event => onSelect(index, event.shiftKey)}
              >
                <SlideThumbnail
                  number={slide.number}
                  label={
                    picture?.slide.titleSlide
                      ? '제목'
                      : lines?.length === 0
                        ? '빈 슬라이드'
                        : undefined
                  }
                  text={lines?.join('\n')}
                  canvas={
                    picture === undefined ? undefined : (
                      <SlidePicture {...picture} />
                    )
                  }
                  selected={index >= start && index <= end}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
