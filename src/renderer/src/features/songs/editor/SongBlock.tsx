import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  memo,
  useRef,
  type JSX,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type {LabelColor} from '@core/labels/colors';
import {LabelTag} from '@renderer/ui/LabelChip';
import {isComposing} from '@renderer/ui/ime';
import {linearSlidesOf, type EditorSlideItem} from '@core/songs/blockEdits';
import {adjacentBlock, editorCommand} from './editorKeys';
import type {SongSession} from './songSession';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import styles from './SongEditor.module.css';

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
  readonly locked: boolean;
  readonly editable: boolean;
  readonly color: LabelColor;
  readonly expanded: boolean;
  readonly onOpen: (anchor: HTMLElement, block: number) => void;
  readonly top: number;
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
  }: BlockProps): JSX.Element => {
    const labelButtonRef = useRef<HTMLButtonElement | null>(null);

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
        className={styles.block}
        data-active={active}
        data-editor-block={block}
        style={{top}}
      >
        <span className={styles.number}>{block + 1}</span>
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
    );
  },
);
