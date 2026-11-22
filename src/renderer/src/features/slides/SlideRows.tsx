import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from 'react';
import type {SlideId} from '@core/schema/ids';
import type {ShowTile} from '@core/schema/showService';
import type {ThemeFile} from '@core/schema/theme';
import {changeSlides, withLabel} from '@core/slides/edits';
import {themeOfSlide} from '@core/theme/themes';
import {LabelMenu} from '@renderer/features/labels/LabelMenu';
import {useLabelCatalog} from '@renderer/features/labels/labels';
import {useThemes} from '@renderer/platform/themes';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useMeasuredRows} from '@renderer/ui/useMeasuredRows';
import {addSlide} from './deckCommands';
import {
  focusText,
  selectInDeck,
  selectionOf,
  useDeckSelection,
  useReveal,
} from './deckSelection';
import {visibleGridInsertionPosition} from './gridInsertionPosition';
import type {SlideDeck} from './slideDeck';
import {shownColumns, useSlideColumns} from './slideColumns';
import {SlideRow} from './SlideRow';
import {useSlideSurfaceView} from './SlideSurfaceView';
import {splitAtCaret} from './deckTexts';
import {useRevealInsertedSlide} from './useRevealInsertedSlide';
import {GRID_GAP, useSlideRowWindow} from './useSlideRowWindow';
import styles from './SlideEditor.module.css';

const NO_BOXES: readonly string[] = [];
const LIST_ROW_HEIGHT = 116;
const TEXT_ROW_HEIGHT = 22;
const GRID_CELL_CHROME = 60;

/** The theme of every slide, and the boxes of it that have a column. */
function useRowThemes(
  tiles: readonly ShowTile[],
): ReadonlyMap<
  string,
  {readonly theme: ThemeFile; readonly boxes: readonly string[]}
> {
  const themes = useThemes(view => view.themes);
  const columns = useSlideColumns();
  return useMemo(() => {
    const own = new Map<
      string,
      {readonly theme: ThemeFile; readonly boxes: readonly string[]}
    >();
    for (const {slide} of tiles) {
      if (own.has(slide.theme)) continue;
      const theme = themeOfSlide(themes, slide);
      own.set(slide.theme, {theme, boxes: shownColumns(theme, columns)});
    }
    return own;
  }, [tiles, themes, columns]);
}

function textRows({slide}: ShowTile): number {
  return Math.max(
    1,
    ...Object.values(slide.texts).map(text => text.split('\n').length),
  );
}

/** The field of a slide that a key goes to, in one list of slides. */
function fieldOf(
  target: EventTarget | null,
  deck: string,
): HTMLTextAreaElement | null {
  return target instanceof HTMLTextAreaElement &&
    target.dataset['slideField'] !== undefined &&
    target.closest<HTMLElement>('[data-slide-deck]')?.dataset['slideDeck'] ===
      deck
    ? target
    : null;
}

/** The slides of a deck as rows with their fields, or as a grid of pictures. */
export function SlideRows({
  deck,
  tiles,
  decoration,
}: {
  readonly deck: SlideDeck;
  readonly tiles: readonly ShowTile[];
  /** Drawn over the grid, such as the clips of overlays. */
  readonly decoration?: ((revision: string) => ReactNode) | undefined;
}): JSX.Element {
  const view = useSlideSurfaceView();
  const grid = view.mode === 'grid';
  const selection = useDeckSelection(deck);
  const reveal = useReveal();
  const catalog = useLabelCatalog();
  const rowThemes = useRowThemes(tiles);
  const viewport = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<{
    readonly anchor: HTMLElement;
    readonly id: SlideId;
  } | null>(null);
  const ids = useMemo(() => tiles.map(tile => tile.slide.id), [tiles]);
  const {current, saveHeight} = useMeasuredRows(
    `${deck.id}:${view.mode}:${view.scale}`,
    ids,
    viewport,
  );
  const heightOf = useCallback(
    (index: number, cellWidth: number): number => {
      const tile = tiles[index];
      if (tile === undefined) return 0;
      const measured = current.values[tile.slide.id];
      if (measured !== undefined) return measured;
      return grid
        ? (cellWidth * 9) / 16 + GRID_CELL_CHROME
        : Math.max(LIST_ROW_HEIGHT, 40 + TEXT_ROW_HEIGHT * textRows(tile));
    },
    [tiles, current, grid],
  );
  const focusedIndex = useMemo(() => {
    const {focus} = selection;
    return focus?.kind === 'slide'
      ? tiles.findIndex(tile => tile.slide.id === focus.id)
      : -1;
  }, [selection, tiles]);
  const {total, offsets, columns, cellWidth, indices, setScrollTop} =
    useSlideRowWindow({
      viewport,
      count: tiles.length,
      heightOf,
      focused: focusedIndex,
      mode: view.mode,
      scale: view.scale,
    });
  useRevealInsertedSlide({
    viewport,
    ids,
    offsets,
    columns,
    focused: focusedIndex,
    intent: reveal,
  });
  useWindowShortcuts(
    (
      [
        'edit.undo',
        'edit.redo',
        'editor.newSlide',
        'editor.splitSlide',
        'editor.labelMenu',
      ] as const
    ).map(id => ({
      id,
      context: 'song' as const,
      when: (event: KeyboardEvent) =>
        !deck.readOnly &&
        !event.isComposing &&
        fieldOf(event.target, deck.id) !== null,
      unavailable: () => {
        if (id === 'edit.undo') {
          return deck.canUndo ? undefined : NOTHING_TO_UNDO;
        }
        if (id === 'edit.redo') {
          return deck.canRedo ? undefined : NOTHING_TO_REDO;
        }
        return undefined;
      },
      run: () => {
        const field = fieldOf(document.activeElement, deck.id);
        if (field === null) return;
        switch (id) {
          case 'edit.undo':
            deck.replay('undo');
            break;
          case 'edit.redo':
            deck.replay('redo');
            break;
          case 'editor.splitSlide':
            splitAtCaret(deck, field);
            break;
          case 'editor.newSlide': {
            const added = addSlide(deck);
            const box = rowThemes.get(added.theme)?.boxes[0];
            if (box !== undefined) {
              focusText(deck.id, {id: added.id, box, at: 0});
            }
            break;
          }
          case 'editor.labelMenu': {
            const slide = deck.slides.find(
              entry => entry.id === field.dataset['slideField'],
            );
            if (slide !== undefined) setLabel({anchor: field, id: slide.id});
            break;
          }
        }
      },
    })),
  );
  const openLabel = useCallback(
    (anchor: HTMLElement, id: SlideId): void => {
      if (!selectionOf(deck).ids.has(id)) {
        selectInDeck(deck, {type: 'click', id});
      }
      setLabel(before => (before?.anchor === anchor ? null : {anchor, id}));
    },
    [deck],
  );
  const placeOf = (index: number): CSSProperties => {
    const row = Math.floor(index / columns);
    const top = offsets[row] ?? 0;
    if (!grid) return {top};
    return {
      top,
      left:
        cellWidth > 0
          ? (index % columns) * (cellWidth + GRID_GAP)
          : `${((index % columns) * 100) / columns}%`,
      right: 'auto',
      width: cellWidth > 0 ? cellWidth : `${100 / columns}%`,
      boxSizing: 'border-box',
    };
  };
  const last = deck.slides.length;
  const endGap = (
    <button
      type="button"
      className={styles.endGap}
      data-slide-gap={last}
      data-caret={selection.caret === last}
      tabIndex={-1}
      aria-label="마지막 슬라이드 뒤에 삽입"
      style={
        grid
          ? visibleGridInsertionPosition({
              index: last,
              count: last,
              leading: 0,
              columns,
              width: cellWidth,
              columnGap: GRID_GAP,
              offsets,
            })
          : undefined
      }
      onClick={event => {
        selectInDeck(deck, {type: 'gap', index: last});
        event.currentTarget
          .closest<HTMLElement>('[data-slide-surface]')
          ?.focus();
      }}
    />
  );
  return (
    <div
      ref={viewport}
      role="group"
      aria-label="슬라이드"
      className={styles.blocks}
      data-slide-deck={deck.id}
      data-view={view.mode}
      data-slide-columns={columns}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className={styles.blockWindow} style={{height: total}}>
        {indices.map(index => {
          const tile = tiles[index];
          if (tile === undefined) return null;
          const {slide} = tile;
          const own = rowThemes.get(slide.theme);
          return (
            <SlideRow
              key={slide.id}
              deck={deck}
              tile={tile}
              tiles={tiles}
              index={index}
              theme={own?.theme}
              boxes={grid ? NO_BOXES : (own?.boxes ?? NO_BOXES)}
              selected={selection.ids.has(slide.id)}
              focused={focusedIndex === index}
              caret={selection.caret === index}
              grid={grid}
              column={index % columns}
              style={placeOf(index)}
              labelOpen={label?.id === slide.id}
              onLabel={openLabel}
              onHeight={saveHeight}
            />
          );
        })}
        {grid ? endGap : null}
        {grid
          ? decoration?.(
              `${cellWidth}:${indices.join(',')}:${offsets.join(',')}`,
            )
          : null}
      </div>
      {grid ? null : endGap}
      {label === null || catalog === null ? null : (
        <LabelMenu
          store={catalog}
          anchor={label.anchor}
          selected={deck.slides.find(slide => slide.id === label.id)?.label}
          onChoose={name => {
            const {ids: chosen} = selectionOf(deck);
            deck.edit(slides =>
              changeSlides(
                slides,
                chosen.has(label.id) ? chosen : new Set([label.id]),
                slide => withLabel(slide, name),
              ),
            );
          }}
          onClose={restore => {
            setLabel(null);
            if (restore) label.anchor.focus();
          }}
        />
      )}
    </div>
  );
}
