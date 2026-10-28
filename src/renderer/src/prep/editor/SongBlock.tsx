import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {createPortal} from 'react-dom';
import type {LabelColor} from '@shared/colors';
import type {Slide} from '@shared/schema/song';
import {Icon} from '@renderer/ui/Icon';
import {LabelTag} from '@renderer/ui/LabelChip';
import {isComposing} from '@renderer/ui/ime';
import {useButtonPress} from '@renderer/ui/press';
import {layerContainer} from '@renderer/ui/layers';
import {placeFloating} from '@renderer/ui/floating';
import {placeTooltip, viewportSize} from '@renderer/ui/placement';
import tooltipStyles from '@renderer/ui/Tooltip.module.css';
import {isGroupedSong, type AnySong} from '@shared/schema/groupedSong';
import {
  linearBlockAddress,
  linearSlidesOf,
  type EditorSlideItem,
} from './blockEdits';
import {adjacentBlock, editorCommand} from './editorKeys';
import type {SongSession} from './songSession';
import styles from './SongEditor.module.css';

export const BACKSPACE_REFUSAL_MESSAGE =
  '그룹 경계에서는 슬라이드를 합칠 수 없습니다';

export interface EditorFocus {
  inputs: Array<HTMLTextAreaElement | null>;
  requested: boolean;
  composing: boolean;
  restoring: boolean;
  target?: 'lyrics' | 'label';
}

interface BlockProps {
  readonly slide: Slide | EditorSlideItem;
  readonly block: number;
  readonly session: SongSession<AnySong>;
  readonly focus: RefObject<EditorFocus>;
  readonly active: boolean;
  readonly locked: boolean;
  readonly editable: boolean;
  readonly color: LabelColor;
  readonly expanded: boolean;
  readonly onOpen: (anchor: HTMLElement, block: number) => void;
  readonly top: number;
  readonly isGroupStart?: boolean;
}

/** Keeps untouched blocks out of the typing render path. */
export const SongBlock = memo(
  ({
    slide,
    block,
    session,
    focus,
    active,
    locked,
    editable,
    color,
    expanded,
    onOpen,
    top,
    isGroupStart: propIsGroupStart,
  }: BlockProps): JSX.Element => {
    const song = session.history.snapshot.song;
    const isGrouped = isGroupedSong(song);
    const isGroupStart =
      propIsGroupStart ??
      (isGrouped
        ? (linearBlockAddress(song, block)?.isGroupStart ?? true)
        : true);

    const [refused, setRefused] = useState(false);
    const splitButtonRef = useRef<HTMLButtonElement | null>(null);
    const splitPress = useButtonPress<HTMLButtonElement>({
      disabled: locked,
      onPress: event => onOpen(event.currentTarget, block),
    });
    const labelButtonRef = useRef<HTMLButtonElement | null>(null);
    const refusalTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    );

    const showRefusal = useCallback((): void => {
      setRefused(true);
      clearTimeout(refusalTimer.current);
      refusalTimer.current = setTimeout(() => {
        setRefused(false);
      }, 2000);
    }, []);

    useEffect(() => {
      return () => {
        clearTimeout(refusalTimer.current);
      };
    }, []);

    useEffect(() => {
      return session.onBackspaceRefused(refusedBlock => {
        if (refusedBlock === block) {
          showRefusal();
        }
      });
    }, [session, block, showRefusal]);

    const refusalTooltip =
      refused && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="tooltip"
              className={tooltipStyles.tooltip}
              ref={element => {
                const input = focus.current.inputs[block];
                if (element !== null && input !== null && input !== undefined) {
                  placeFloating(element, size =>
                    placeTooltip(
                      input.getBoundingClientRect(),
                      size,
                      viewportSize(),
                    ),
                  );
                }
              }}
            >
              {BACKSPACE_REFUSAL_MESSAGE}
            </div>,
            layerContainer('tooltip'),
          )
        : null;

    const select = (input: HTMLTextAreaElement): void => {
      if (focus.current.restoring || focus.current.requested) return;
      session.select({
        block,
        start: input.selectionStart,
        end: input.selectionEnd,
      });
    };

    const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (locked || focus.current.composing || isComposing(event)) return;
      select(event.currentTarget);
      if (
        editable &&
        event.code === 'KeyG' &&
        event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        const anchor =
          splitButtonRef.current ??
          labelButtonRef.current ??
          event.currentTarget;
        onOpen(anchor, block);
        return;
      }
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
        className={styles.block}
        data-active={active}
        data-editor-block={block}
        style={{top}}
      >
        <span className={styles.number}>{block + 1}</span>
        <div className={styles.label}>
          {isGroupStart ? (
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
          ) : active && editable ? (
            <button
              {...splitPress}
              ref={splitButtonRef}
              type="button"
              aria-label="새 그룹"
              className={styles.splitButton}
            >
              <Icon name="plus" size={12} />
              <span>새 그룹</span>
            </button>
          ) : null}
        </div>
        <textarea
          ref={input => {
            focus.current.inputs[block] = input;
          }}
          aria-label={`슬라이드 ${block + 1} 가사`}
          className={styles.lyrics}
          value={slide.lines.join('\n')}
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
            event.preventDefault();
            select(event.currentTarget);
            focus.current.requested = true;
            focus.current.target = 'lyrics';
            session.edit({
              type: 'paste',
              text: event.clipboardData.getData('text/plain'),
            });
          }}
        />
        {refusalTooltip}
      </div>
    );
  },
);
