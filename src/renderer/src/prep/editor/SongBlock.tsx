import {memo, type JSX, type KeyboardEvent, type RefObject} from 'react';
import type {LabelColor} from '@shared/colors';
import type {Slide} from '@shared/schema/song';
import {LabelTag} from '@renderer/ui/LabelChip';
import {isComposing} from '@renderer/ui/ime';
import {adjacentBlock, editorCommand} from './editorKeys';
import type {SongSession} from './songSession';
import styles from './SongEditor.module.css';

export interface EditorFocus {
  inputs: Array<HTMLTextAreaElement | null>;
  requested: boolean;
  composing: boolean;
  restoring: boolean;
  target?: 'lyrics' | 'label';
}

interface BlockProps {
  readonly slide: Slide;
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
      const command = editorCommand(event);
      const adjacent = adjacentBlock(
        event,
        session.history.snapshot.song.slides.map(part => part.lines.join('\n')),
        block,
      );
      if (command === undefined && adjacent === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      focus.current.requested = true;
      focus.current.target = 'lyrics';
      if (command !== undefined) session.edit(command);
      else if (adjacent !== undefined) session.select(adjacent);
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
          <LabelTag
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
          onFocus={event => select(event.currentTarget)}
          onSelect={event => {
            if (event.currentTarget === document.activeElement) {
              select(event.currentTarget);
            }
          }}
          onBlur={() => {
            focus.current.composing = false;
            session.endTyping();
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
      </div>
    );
  },
);
