import {
  memo,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type JSX,
} from 'react';
import {flushSync} from 'react-dom';
import type {SlideId} from '@core/schema/common/ids';
import type {ShowTile} from '@core/schema/services/showService';
import type {ThemeFile} from '@core/schema/screens/theme';
import {TilePicture} from '@renderer/pictures/TilePicture';
import {classNames} from '@renderer/ui/classNames';
import {
  isLayoutResizeActive,
  onLayoutResizeEnd,
} from '@renderer/ui/panels/layoutResize';
import {SlideThumbnailBand} from '@renderer/ui/tiles/SlideThumbnail';
import {SlideTransitionMark} from '@renderer/ui/tiles/SlideTransitionMark';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';
import {selectInDeck} from './deckSelection';
import {EditorSlideNumber} from './EditorSlideNumber';
import type {SlideDeck} from './slideDeck';
import {SlideTextField} from './SlideTextField';
import plate from './EditorSlidePlate.module.css';
import styles from './SlideEditor.module.css';

interface SlideRowProps {
  readonly deck: SlideDeck;
  readonly tile: ShowTile;
  readonly tiles: readonly ShowTile[];
  readonly index: number;
  readonly theme: ThemeFile | undefined;
  /** The boxes with a field in this row; none in the grid. */
  readonly boxes: readonly string[];
  readonly selected: boolean;
  readonly focused: boolean;
  readonly caret: boolean;
  readonly grid: boolean;
  readonly column: number;
  readonly style: CSSProperties;
  readonly labelOpen: boolean;
  readonly onLabel: (anchor: HTMLElement, id: SlideId) => void;
  readonly onHeight: (id: string, height: number) => void;
  readonly onOpen?: ((id: SlideId) => void) | undefined;
}

/** One slide of the editor: its picture, and the fields of its boxes. */
export const SlideRow = memo(
  ({
    deck,
    tile,
    tiles,
    index,
    theme,
    boxes,
    selected,
    focused,
    caret,
    grid,
    column,
    style,
    labelOpen,
    onLabel,
    onHeight,
    onOpen,
  }: SlideRowProps): JSX.Element => {
    const row = useRef<HTMLDivElement>(null);
    const {slide, labelColor} = tile;
    const number = index + 1;
    useLayoutEffect(() => {
      const node = row.current;
      if (node === null) return undefined;
      const measure = (): void => {
        const height = Math.ceil(node.getBoundingClientRect().height);
        if (height > 0) onHeight(slide.id, height);
      };
      measure();
      // NOTE(0913vision): The rows below move in the frame the text grows in,
      // not one frame after it.
      const observer = new ResizeObserver(() => {
        if (!isLayoutResizeActive()) flushSync(measure);
      });
      const stop = onLayoutResizeEnd(measure);
      observer.observe(node, {box: 'border-box'});
      return () => {
        stop();
        observer.disconnect();
      };
    }, [grid, onHeight, slide.id]);
    const band = (
      <SlideThumbnailBand
        number={number}
        label={slide.label}
        labelColor={labelColor}
      />
    );
    return (
      <div
        ref={row}
        className={classNames(styles.block, plate.row, grid && plate.grid)}
        style={style}
        aria-selected={selected}
        data-active={selected}
        data-focused={focused}
        data-menu-row
        data-song-slide={slide.id}
        data-slide-index={index}
        data-grid={grid || undefined}
        draggable={!deck.readOnly}
        onFocusCapture={event => {
          if (!isInTextEntry(event.target) || selected) return;
          selectInDeck(deck, {type: 'click', id: slide.id});
        }}
        onClick={event => {
          if (
            event.target instanceof Element &&
            event.target.closest('textarea, input, button') !== null
          ) {
            return;
          }
          selectInDeck(deck, {
            type: 'click',
            id: slide.id,
            shift: event.shiftKey,
            ctrl: event.ctrlKey || event.metaKey,
          });
        }}
        onDoubleClick={event => {
          if (!isInTextEntry(event.target)) onOpen?.(slide.id);
        }}
      >
        <button
          type="button"
          className={styles.gap}
          style={
            grid && column === 0
              ? {insetInlineStart: 0, width: 'var(--space-14)'}
              : undefined
          }
          data-caret={caret}
          data-slide-gap={index}
          tabIndex={-1}
          aria-label={`슬라이드 ${number} 앞에 삽입`}
          onClick={event => {
            event.stopPropagation();
            selectInDeck(deck, {type: 'gap', index});
            event.currentTarget
              .closest<HTMLElement>('[data-slide-surface]')
              ?.focus();
          }}
        />
        {grid ? null : (
          <EditorSlideNumber
            number={number}
            selected={selected}
            onToggle={() =>
              selectInDeck(deck, {type: 'click', id: slide.id, ctrl: true})
            }
          />
        )}
        <div className={styles.thumbnail}>
          <div className={styles.thumbnailCanvas}>
            <TilePicture tile={tile} tiles={tiles} />
            <SlideTransitionMark transition={slide.transition} />
          </div>
          {deck.readOnly ? (
            band
          ) : (
            <button
              type="button"
              className={styles.bandButton}
              aria-label={`${slide.label ?? '이름표 없음'} ${number}`}
              aria-expanded={labelOpen}
              onClick={event => onLabel(event.currentTarget, slide.id)}
            >
              {band}
            </button>
          )}
        </div>
        {grid ? null : (
          <div className={styles.fields}>
            {theme === undefined
              ? null
              : boxes.map(box => (
                  <SlideTextField
                    key={box}
                    deck={deck}
                    tile={tile}
                    theme={theme}
                    box={box}
                    alone={boxes.length === 1 && theme.boxes.length === 1}
                    inList
                  />
                ))}
          </div>
        )}
      </div>
    );
  },
);
