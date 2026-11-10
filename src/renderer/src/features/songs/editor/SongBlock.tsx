import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  memo,
  useLayoutEffect,
  useRef,
  type JSX,
  type KeyboardEvent,
  type RefObject,
  type ReactNode,
} from 'react';
import type {LabelColor} from '@core/labels/colors';
import {LabelTag} from '@renderer/ui/LabelChip';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import {isComposing} from '@renderer/ui/ime';
import {linearSlidesOf, type EditorSlideItem} from '@core/songs/blockEdits';
import {adjacentBlock, editorCommand} from './editorKeys';
import type {SongSession} from './songSession';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import styles from './SongEditor.module.css';
import {SlideTransitionMark} from '@renderer/ui/SlideTransitionMark';
import {EditorSlideNumber} from './EditorSlideNumber';
import plate from './EditorSlidePlate.module.css';
import {SONG_LIMITS} from '@core/schema/song';
import type {SlideCardRenderer} from './SlideCardRenderer';

export interface EditorFocus {
  inputs: Array<HTMLTextAreaElement | null>;
  requested: boolean;
  composing: boolean;
  restoring: boolean;
  target?: 'lyrics' | 'label';
}

interface BlockProps {
  readonly slide: EditorSlideItem;
  readonly block: number;
  readonly session: SongSession;
  readonly focus: RefObject<EditorFocus>;
  readonly active: boolean;
  readonly focused?: boolean;
  readonly locked: boolean;
  readonly editable: boolean;
  readonly color: LabelColor;
  readonly expanded: boolean;
  readonly onOpen: (anchor: HTMLElement, block: number) => void;
  readonly top: number;
  readonly column?: number;
  readonly columns?: number;
  readonly cellWidth?: number;
  readonly columnGap?: number;
  readonly grid?: boolean;
  readonly numberOffset?: number;
  readonly rowHeight?: number | undefined;
  readonly onMeasure?: ((id: string, height: number) => void) | undefined;
  readonly caret?: boolean;
  readonly canvas?: ReactNode;
  readonly renderCard?: SlideCardRenderer<EditorSlideItem> | undefined;
}

/** Keeps untouched blocks out of the typing render path. */
export const SongBlock = memo(
  ({
    slide,
    block,
    session,
    focus,
    active,
    focused = false,
    locked,
    editable,
    color,
    expanded,
    onOpen,
    top,
    column = 0,
    columns = 1,
    cellWidth = 0,
    columnGap = 0,
    grid = false,
    numberOffset = 0,
    rowHeight,
    onMeasure,
    caret,
    canvas,
    renderCard,
  }: BlockProps): JSX.Element => {
    const labelButtonRef = useRef<HTMLButtonElement | null>(null);
    const blockRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      const node = blockRef.current;
      if (!grid || node === null || onMeasure === undefined) return;
      const thumbnail = node.querySelector<HTMLElement>(
        '[data-editor-thumbnail]',
      );
      const text = node.querySelector<HTMLElement>('[data-grid-text]');
      if (thumbnail === null || text === null) return;
      const measure = (): void => {
        const css = getComputedStyle(node);
        const px = (name: string): number =>
          Number.parseFloat(css.getPropertyValue(name)) || 0;
        const cellChromeHeight =
          px('row-gap') +
          px('padding-top') +
          px('padding-bottom') +
          px('border-top-width') +
          px('border-bottom-width');
        const height =
          thumbnail.getBoundingClientRect().height +
          text.getBoundingClientRect().height +
          cellChromeHeight;
        if (height > 0) onMeasure(slide.id, Math.ceil(height));
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      observer.observe(thumbnail);
      observer.observe(text);
      return () => observer.disconnect();
    }, [grid, onMeasure, renderCard, slide.id]);

    const select = (input: HTMLTextAreaElement): void => {
      if (focus.current.restoring || focus.current.requested) return;
      session.select({
        block,
        start: input.selectionStart,
        end: input.selectionEnd,
      });
    };

    useWindowShortcuts([
      ...(
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
        when: (event: globalThis.KeyboardEvent) =>
          !locked &&
          !focus.current.composing &&
          event.target === focus.current.inputs[block] &&
          (id !== 'editor.labelMenu' || editable),
        unavailable: () =>
          id === 'edit.undo'
            ? session.history.canUndo
              ? undefined
              : NOTHING_TO_UNDO
            : id === 'edit.redo'
              ? session.history.canRedo
                ? undefined
                : NOTHING_TO_REDO
              : undefined,
        run: () => {
          const input = focus.current.inputs[block];
          if (input === null || input === undefined) return;
          select(input);
          if (id === 'editor.labelMenu') {
            onOpen(labelButtonRef.current ?? input, block);
            return;
          }
          focus.current.requested = true;
          focus.current.target = 'lyrics';
          session.edit(
            id === 'edit.undo'
              ? 'undo'
              : id === 'edit.redo'
                ? 'redo'
                : {type: id === 'editor.newSlide' ? 'insert' : 'split'},
          );
        },
      })),
    ]);

    const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (locked || focus.current.composing || isComposing(event)) return;
      select(event.currentTarget);
      const command = editorCommand(event);
      const adjacent = adjacentBlock(
        event,
        linearSlidesOf(session.history.snapshot.song).map(part =>
          part.lines.join('\n'),
        ),
        block,
      );
      if (command === undefined && adjacent === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      focus.current.requested = true;
      focus.current.target = 'lyrics';
      if (command !== undefined) {
        session.edit(command);
      } else if (adjacent !== undefined) {
        session.select(adjacent);
      }
    };

    return (
      <div
        ref={blockRef}
        className={`${styles.block} ${plate.row} ${grid ? plate.grid : ''}`}
        data-active={active}
        data-focused={focused}
        data-editor-block={block}
        data-song-slide={slide.id}
        data-slide-index={block}
        draggable={!locked}
        data-grid={grid || undefined}
        style={
          grid
            ? {
                top,
                left:
                  cellWidth > 0
                    ? `${column * (cellWidth + columnGap)}px`
                    : `${(column * 100) / columns}%`,
                right: 'auto',
                width: cellWidth > 0 ? `${cellWidth}px` : `${100 / columns}%`,
                boxSizing: 'border-box',
                minHeight: rowHeight,
              }
            : {top}
        }
        onClick={event => {
          if (
            event.target instanceof Element &&
            event.target.closest('textarea, input, button')
          ) {
            return;
          }
          session.selectSlides({
            type: 'click',
            id: slide.id,
            shift: event.shiftKey,
            ctrl: event.ctrlKey || event.metaKey,
          });
        }}
      >
        <button
          type="button"
          className={styles.gap}
          data-caret={caret}
          data-slide-gap={block}
          tabIndex={-1}
          aria-label={`슬라이드 ${block + 1 + numberOffset} 앞에 삽입`}
          onClick={event => {
            event.stopPropagation();
            session.selectSlides({type: 'gap', index: block});
            event.currentTarget
              .closest<HTMLElement>('[aria-label="슬라이드 편집 명령"]')
              ?.focus();
          }}
        />
        {grid ? null : (
          <EditorSlideNumber
            number={block + 1 + numberOffset}
            selected={active}
            onToggle={() =>
              session.selectSlides({type: 'click', id: slide.id, ctrl: true})
            }
          />
        )}
        {renderCard?.(slide, block, grid ? 'grid' : 'list') ?? (
          <>
            <div className={styles.thumbnail} data-editor-thumbnail>
              <div className={styles.thumbnailCanvas}>
                {canvas}
                <SlideTransitionMark transition={slide.transition} />
              </div>
              {grid && editable ? (
                <button
                  ref={labelButtonRef}
                  type="button"
                  className={styles.bandButton}
                  aria-label={`\uC774\uB984\uD45C ${block + 1 + numberOffset}`}
                  aria-expanded={expanded}
                  onClick={event => {
                    if (!locked) onOpen(event.currentTarget, block);
                  }}
                >
                  <SlideThumbnailBand
                    number={block + 1 + numberOffset}
                    label={slide.label}
                    labelColor={color}
                  />
                </button>
              ) : (
                <SlideThumbnailBand
                  number={block + 1 + numberOffset}
                  label={slide.label}
                  labelColor={color}
                />
              )}
            </div>
            <div className={styles.text} data-grid-text>
              {grid ? null : (
                <div className={styles.label}>
                  {
                    <LabelTag
                      buttonRef={labelButtonRef}
                      name={slide.label === '' ? undefined : slide.label}
                      color={color}
                      picker={
                        !editable
                          ? undefined
                          : {
                              expanded,
                              onOpen: anchor => {
                                if (!locked) onOpen(anchor, block);
                              },
                            }
                      }
                    />
                  }
                </div>
              )}
              <textarea
                ref={input => {
                  focus.current.inputs[block] = input;
                }}
                aria-label={`슬라이드 ${block + 1 + numberOffset} ${slide.titleSlide ? '제목 및 부제' : '가사'}`}
                title={
                  slide.titleSlide
                    ? `제목 및 부제: 두 줄, 각 ${SONG_LIMITS.titleLine}자`
                    : undefined
                }
                className={styles.lyrics}
                value={slide.lines.join('\n')}
                data-empty={slide.lines.join('\n') === '' || undefined}
                rows={Math.max(1, slide.lines.length)}
                readOnly={locked}
                wrap="off"
                spellCheck={false}
                onFocus={event => {
                  select(event.currentTarget);
                }}
                onBlur={() => {
                  focus.current.composing = false;
                  session.endTyping();
                }}
                onSelect={event => {
                  if (event.currentTarget === document.activeElement) {
                    select(event.currentTarget);
                  }
                }}
                onCompositionStart={() => {
                  focus.current.composing = true;
                }}
                onCompositionEnd={() => {
                  focus.current.composing = false;
                }}
                onKeyDown={keyDown}
                onChange={event => {
                  if (locked) return;
                  const input = event.currentTarget;
                  select(input);
                  session.edit({
                    type: 'text',
                    text: input.value,
                    start: input.selectionStart,
                    end: input.selectionEnd,
                  });
                }}
                onPaste={event => {
                  if (locked || focus.current.composing) return;
                  const text = event.clipboardData.getData('text/plain');
                  event.preventDefault();
                  if (text === '') return;
                  select(event.currentTarget);
                  focus.current.requested = true;
                  focus.current.target = 'lyrics';
                  session.edit({
                    type: 'paste',
                    text,
                  });
                }}
              />
            </div>
          </>
        )}
      </div>
    );
  },
);
