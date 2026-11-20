import {
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from 'react';
import type {PowerPointSource} from '@core/schema/powerpointImport';
import type {
  PictureSpec,
  PictureService,
} from '@renderer/rendering/pictures/pictureService';
import {Picture} from '@renderer/rendering/pictures/Picture';
import {SlideThumbnail} from '@renderer/ui/SlideThumbnail';
import {Checkbox} from '@renderer/ui/Checkbox';
import {thumbnailWidth} from '@renderer/ui/thumbnailSize';
import styles from './PowerPointImport.module.css';

const BASE_COLUMNS = 4;
const OVERSCAN = 1;
const INITIAL_ROWS = 3;

interface Measure {
  readonly width: number;
  readonly height: number;
  readonly gap: number;
  readonly band: number;
}
const EMPTY: Measure = {width: 0, height: 0, gap: 0, band: 0};

/** Shows only visible rows, waiting for each output picture before revealing them. */
export function PowerPointPreviewGrid({
  slides,
  specs,
  service,
  start,
  end,
  selected,
  scale = 100,
  onSelect,
  onSelectAll,
  onToggle,
  isReady,
}: {
  readonly slides: PowerPointSource['slides'];
  readonly specs: readonly PictureSpec[];
  readonly service: PictureService;
  readonly start: number;
  readonly end: number;
  readonly selected?: ReadonlySet<number> | undefined;
  readonly scale?: number | undefined;
  readonly onSelect: (index: number, shift: boolean) => void;
  readonly onSelectAll?: (() => void) | undefined;
  readonly onToggle?: ((index: number) => void) | undefined;
  readonly isReady?: ((index: number) => boolean) | undefined;
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
  const tileWidth = thumbnailWidth({
    gridWidth: measure.width,
    columns: BASE_COLUMNS,
    gap: measure.gap,
    scalePercent: scale,
  });
  const columns =
    tileWidth > 0
      ? Math.max(
          1,
          Math.floor((measure.width + measure.gap) / (tileWidth + measure.gap)),
        )
      : BASE_COLUMNS;
  const stride =
    tileWidth > 0 ? (tileWidth * 9) / 16 + measure.band + measure.gap : 1;
  const rows = Math.ceil(slides.length / columns);
  const visible =
    measure.height > 0 ? Math.ceil(measure.height / stride) : INITIAL_ROWS;
  const first = Math.max(
    0,
    Math.min(
      Math.floor(scrollTop / stride) - OVERSCAN,
      Math.max(0, rows - visible),
    ),
  );
  const begin = first * columns;
  const finish = Math.min(
    slides.length,
    (first + visible + OVERSCAN * 2) * columns,
  );
  const offset: CSSProperties = {
    top: first * stride,
    gridTemplateColumns: `repeat(${columns}, ${tileWidth || 1}px)`,
  };
  return (
    <div
      ref={viewport}
      className={styles.gridViewport}
      role="listbox"
      aria-label="슬라이드"
      aria-multiselectable="true"
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDown={event => {
        if (
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          event.key.toLowerCase() === 'a'
        ) {
          event.preventDefault();
          event.stopPropagation();
          onSelectAll?.();
        }
      }}
    >
      <div className={styles.gridSpacer} style={{height: rows * stride}}>
        <div className={styles.grid} style={offset}>
          {slides.slice(begin, finish).map((slide, local) => {
            const index = begin + local;
            const spec = specs[index];
            const checked =
              selected?.has(index) ?? (index >= start && index <= end);
            return (
              <div
                key={slide.number}
                className={styles.tile}
                onClick={event => onSelect(index, event.shiftKey)}
                onKeyDown={event => {
                  if (
                    event.key === ' ' &&
                    !event.ctrlKey &&
                    !event.altKey &&
                    !event.metaKey &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggle?.(index);
                  }
                }}
              >
                <span
                  className={styles.tileCheck}
                  onClick={event => event.stopPropagation()}
                >
                  <Checkbox
                    aria-label={`${slide.number} 선택`}
                    checked={checked}
                    tabIndex={-1}
                    onChange={() => onToggle?.(index)}
                  />
                </span>
                <SlideThumbnail
                  number={slide.number}
                  label={
                    spec?.layers.slide?.titleSlide
                      ? '제목'
                      : spec?.layers.slide?.lines.length === 0
                        ? '빈 슬라이드'
                        : undefined
                  }
                  text={spec?.layers.slide?.lines.join('\n')}
                  canvas={
                    spec === undefined ||
                    isReady?.(index) === false ? undefined : (
                      <Suspense fallback={null}>
                        <Picture wait service={service} {...spec} />
                      </Suspense>
                    )
                  }
                  selected={checked}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
