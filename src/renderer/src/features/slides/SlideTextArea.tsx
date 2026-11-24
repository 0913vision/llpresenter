import {
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {SLIDE_LIMITS} from '@core/schema/slide';
import type {ShowTile} from '@core/schema/showService';
import type {ThemeFile} from '@core/schema/theme';
import {
  filledText,
  ownText,
  withTypedText,
  changeSlides,
  joinSlide,
  pasteSlideText,
} from '@core/slides';
import {slideMaking} from '@renderer/platform/themes';
import {classNames} from '@renderer/ui/classNames';
import {isComposing} from '@renderer/ui/fields/ime';
import {hasModifier} from '@renderer/ui/keys/modifierKeys';
import field from '@renderer/ui/fields/TextField.module.css';
import {
  clearTextFocus,
  focusSlides,
  focusText,
  useTextFocus,
} from './deckSelection';
import {applyTextEdit} from './deckTexts';
import type {SlideDeck} from './slideDeck';
import styles from './SlideTextField.module.css';

export interface SlideBox {
  readonly deck: SlideDeck;
  readonly tile: ShowTile;
  readonly theme: ThemeFile;
  readonly box: string;
}

/** A text of a list of slides that goes on in the slides around it. */
function useFlowingText(
  {deck, tile, box}: SlideBox,
  flows: boolean,
): {
  readonly onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
} {
  const {slide} = tile;
  const goOn = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    const {selectionStart: start, selectionEnd: end} = event.currentTarget;
    const up = event.key === 'ArrowUp';
    if (start !== end || (!up && event.key !== 'ArrowDown')) return;
    const value = ownText(slide, box);
    const before = value.slice(0, start);
    if (up ? before.includes('\n') : value.slice(end).includes('\n')) return;
    const index = deck.slides.findIndex(entry => entry.id === slide.id);
    const target = deck.slides[up ? index - 1 : index + 1];
    if (target?.theme !== slide.theme) return;
    const text = ownText(target, box);
    const rowStart = up ? text.lastIndexOf('\n') + 1 : 0;
    const row = text.slice(rowStart).split('\n')[0] ?? '';
    const column = start - (before.lastIndexOf('\n') + 1);
    event.preventDefault();
    focusText(deck.id, {
      id: target.id,
      box,
      at: rowStart + Math.min(column, row.length),
    });
  };
  return {
    onKeyDown: event => {
      if (!flows) return;
      const {selectionStart: start, selectionEnd: end} = event.currentTarget;
      if (event.key !== 'Backspace' || start !== 0 || end !== 0) {
        goOn(event);
      } else if (
        applyTextEdit(deck, box, joinSlide(deck.slides, slide.id, box))
      ) {
        event.preventDefault();
      }
    },
    onPaste: event => {
      if (!flows) return;
      const pasted = event.clipboardData
        .getData('text/plain')
        .replace(/\r\n?/gu, '\n');
      if (!/\n[^\S\n]*\n/u.test(pasted)) return;
      const {selectionStart: start, selectionEnd: end} = event.currentTarget;
      const place = {id: slide.id, box, start, end, pasted};
      const change = pasteSlideText(slideMaking(), deck.slides, place);
      if (applyTextEdit(deck, box, change)) event.preventDefault();
    },
  };
}

/** Takes the caret when an edit of the list puts it into this text. */
function useWantedCaret(
  {tile: {slide}, box}: SlideBox,
  inList: boolean,
): (node: HTMLTextAreaElement | null) => void {
  const input = useRef<HTMLTextAreaElement | null>(null);
  const focus = useTextFocus();
  const wanted =
    inList && focus?.id === slide.id && focus.box === box ? focus : null;
  useLayoutEffect(() => {
    const node = input.current;
    if (wanted === null || node === null) return;
    node.focus({preventScroll: true});
    node.setSelectionRange(wanted.at, wanted.at);
    clearTextFocus();
  }, [wanted]);
  return node => {
    input.current = node;
  };
}

/** The text of one box of a slide, or the text its slide before shows. */
export function SlideTextArea({
  id,
  label,
  inList = false,
  locked = false,
  ...place
}: SlideBox & {
  readonly id?: string | undefined;
  /** Its accessible name, when no label element names it. */
  readonly label?: string | undefined;
  readonly inList?: boolean;
  /** Shows what fills the box, which can't be typed over. */
  readonly locked?: boolean;
}): JSX.Element {
  const {deck, tile, theme, box} = place;
  const {slide} = tile;
  const value = ownText(slide, box);
  const many = theme.boxes.find(entry => entry.name === box)?.rows === 'many';
  const readOnly = deck.readOnly || locked;
  const caret = useWantedCaret(place, inList);
  // NOTE(0913vision): A slide that says one thing goes over several slides when
  // its text does; a slide with a title of its own keeps every row.
  const flowing = useFlowingText(
    place,
    many &&
      inList &&
      !readOnly &&
      theme.boxes.every(
        other =>
          other.name === box ||
          other.default !== undefined ||
          ownText(slide, other.name) === '',
      ),
  );
  const set = (text: string): void => {
    const own = many ? text : text.replace(/\s*\n\s*/gu, ' ');
    deck.edit(
      slides =>
        changeSlides(slides, new Set([slide.id]), entry =>
          withTypedText(theme, entry, {box, text: own}),
        ),
      `text:${slide.id}:${box}`,
    );
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (isComposing(event) || hasModifier(event)) return;
    if (
      (event.key === 'Enter' && !many) ||
      (event.key === 'Escape' && !inList)
    ) {
      event.preventDefault();
      event.stopPropagation();
      focusSlides();
      return;
    }
    flowing.onKeyDown(event);
  };
  return (
    <textarea
      ref={caret}
      id={id}
      data-slide-field={slide.id}
      data-slide-box={box}
      aria-label={label}
      className={classNames(field.textarea, styles.input)}
      rows={many ? Math.max(1, value.split('\n').length) : 1}
      maxLength={SLIDE_LIMITS.text}
      value={value}
      placeholder={filledText(theme, tile, box)}
      readOnly={readOnly}
      spellCheck={false}
      onChange={event => {
        if (!readOnly) set(event.currentTarget.value);
      }}
      onKeyDown={keyDown}
      onPaste={flowing.onPaste}
    />
  );
}
