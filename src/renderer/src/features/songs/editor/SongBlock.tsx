import {
  isLayoutResizeActive,
  onLayoutResizeEnd,
} from '@renderer/ui/layoutResize';
import {flushSync} from 'react-dom';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  memo,
  useLayoutEffect,
  useRef,
  type JSX,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type {LabelColor} from '@core/labels/colors';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import {isComposing} from '@renderer/ui/ime';
import {linearSlidesOf, type EditorSlideItem} from '@core/songs/blockEdits';
import {linesOf, type BlockCommand} from '@core/songs/blockModel';
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
import field from '@renderer/ui/TextField.module.css';
import {SONG_LIMITS} from '@core/schema/song';
import type {
  RenderSlideTextFields,
  SlideCardRenderer,
} from './SlideCardRenderer';
import {Picture} from '@renderer/rendering/pictures/Picture';
import {usePrepPictureSwitch} from '@renderer/rendering/PrepPictureSwitch';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {
  pictures,
  type PictureSpec,
} from '@renderer/rendering/pictures/pictureService';

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
  readonly picture?: PictureSpec | undefined;
  readonly renderCard?: SlideCardRenderer<EditorSlideItem> | undefined;
  readonly renderTextFields?: RenderSlideTextFields | undefined;
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
    picture,
    renderCard,
    renderTextFields,
  }: BlockProps): JSX.Element => {
    const labelButtonRef = useRef<HTMLButtonElement | null>(null);
    const blockRef = useRef<HTMLDivElement>(null);
    const chrome = useRef<{node: HTMLElement; height: number} | null>(null);
    const text = slide.lines.join('\n');
    const switching = usePrepPictureSwitch();
    const measureFields = renderTextFields !== undefined;
    useLayoutEffect(() => {
      const node = blockRef.current;
      if (node === null || onMeasure === undefined) return;
      if (!grid) {
        if (!measureFields) return;
        const measure = (): void => {
          const height = Math.ceil(node.getBoundingClientRect().height);
          if (height > 0) onMeasure(slide.id, height);
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
          if (!isLayoutResizeActive()) flushSync(measure);
        });
        const unlisten = onLayoutResizeEnd(measure);
        observer.observe(node, {box: 'border-box'});
        return () => {
          unlisten();
          observer.disconnect();
        };
      }
      const thumbnail = node.querySelector<HTMLElement>(
        '[data-editor-thumbnail]',
      );
      const text = node.querySelector<HTMLElement>('[data-grid-text]');
      if (thumbnail === null || text === null) return;
      const measure = (): void => {
        // NOTE(0913vision): The row's padding, gap and border use fixed tokens;
        // only its thumbnail and text heights change while resizing or typing.
        if (chrome.current?.node !== node) {
          const css = getComputedStyle(node);
          const px = (name: string): number =>
            Number.parseFloat(css.getPropertyValue(name)) || 0;
          chrome.current = {
            node,
            height:
              px('row-gap') +
              px('padding-top') +
              px('padding-bottom') +
              px('border-top-width') +
              px('border-bottom-width'),
          };
        }
        const height =
          thumbnail.getBoundingClientRect().height +
          text.getBoundingClientRect().height +
          chrome.current.height;
        if (height > 0) onMeasure(slide.id, Math.ceil(height));
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      // NOTE(0913vision): The rows below move in the frame the text grows in,
      // not one frame after it.
      const observer = new ResizeObserver(() => {
        if (!isLayoutResizeActive()) flushSync(measure);
      });
      const unlisten = onLayoutResizeEnd(measure);
      observer.observe(thumbnail);
      observer.observe(text);
      return () => {
        unlisten();
        observer.disconnect();
      };
    }, [grid, measureFields, onMeasure, renderCard, slide.id]);

    const select = (input: HTMLTextAreaElement): void => {
      if (focus.current.restoring || focus.current.requested) return;
      session.select({
        block,
        start: input.selectionStart,
        end: input.selectionEnd,
      });
    };

    const applyTextInput = (
      input: HTMLTextAreaElement,
      command: Extract<BlockCommand, {type: 'text' | 'paste'}>,
    ): void => {
      if (
        picture !== undefined &&
        !slide.titleSlide &&
        command.type === 'text'
      ) {
        pictures.prepareEditedLyrics(picture, linesOf(command.text));
      }
      flushSync(() => {
        select(input);
        if (command.type === 'paste') {
          focus.current.requested = true;
          focus.current.target = 'lyrics';
        }
        session.edit(command);
        if (
          picture !== undefined &&
          (slide.titleSlide || command.type === 'paste')
        ) {
          const edited = session.history.model
            .getContent()
            .slides.find(candidate => candidate.id === slide.id);
          if (edited !== undefined) {
            pictures.prepareEditedLyrics(picture, edited.lines);
          }
        }
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
        data-menu-row
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
        onFocusCapture={event => {
          if (renderTextFields !== undefined && isInTextEntry(event.target)) {
            session.selectSlides({type: 'click', id: slide.id});
          }
        }}
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
          style={
            grid && column === 0
              ? {insetInlineStart: 0, width: 'var(--space-14)'}
              : undefined
          }
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
                {picture === undefined ? null : (
                  <Picture
                    {...picture}
                    editing={focused}
                    wait={switching === true}
                    switchSlot={
                      switching === true
                        ? `prep:${session.slideDocumentId}:${slide.id}`
                        : undefined
                    }
                  />
                )}
                <SlideTransitionMark transition={slide.transition} />
              </div>
              {editable && (!grid || renderTextFields === undefined) ? (
                <button
                  ref={labelButtonRef}
                  type="button"
                  className={styles.bandButton}
                  aria-label={`${slide.label === undefined || slide.label === '' ? '이름표 없음' : slide.label} ${block + 1 + numberOffset}`}
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
              {renderTextFields !== undefined ? (
                grid ? null : (
                  renderTextFields(slide.id)
                )
              ) : (
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
                  className={`${field.textarea} ${styles.lyrics}`}
                  value={text}
                  data-empty={text === '' || undefined}
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
                    const {value, selectionStart, selectionEnd} = input;
                    applyTextInput(input, {
                      type: 'text',
                      text: value,
                      start: selectionStart,
                      end: selectionEnd,
                    });
                  }}
                  onPaste={event => {
                    if (locked || focus.current.composing) return;
                    const text = event.clipboardData.getData('text/plain');
                    event.preventDefault();
                    if (text === '') return;
                    applyTextInput(event.currentTarget, {
                      type: 'paste',
                      text,
                    });
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    );
  },
);
