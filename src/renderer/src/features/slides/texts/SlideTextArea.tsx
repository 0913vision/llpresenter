import {
  useLayoutEffect,
  useRef,
  type JSX,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {SLIDE_LIMITS} from '@core/schema/slides/slide';
import type {ShowTile} from '@core/schema/services/showService';
import type {ThemeFile} from '@core/schema/screens/theme';
import {
  filledText,
  ownText,
  withTypedText,
  changeSlides,
  takesManyRows,
} from '@core/slides';
import {classNames} from '@renderer/ui/classNames';
import {isComposing} from '@renderer/ui/fields/ime';
import {useTypedValue} from '@renderer/ui/fields/typedValue';
import {hasModifier} from '@renderer/ui/keys/modifierKeys';
import field from '@renderer/ui/fields/TextField.module.css';
import {clearTextFocus, focusSlides, useTextFocus} from '../deckSelection';
import type {SlideDeck} from '../slideDeck';
import styles from './SlideTextField.module.css';

/** One text box of one slide of a deck, with the theme that defines it. */
export interface SlideBox {
  readonly deck: SlideDeck;
  readonly tile: ShowTile;
  readonly theme: ThemeFile;
  readonly box: string;
}

/** Takes the caret when an edit of the list puts it into this text. */
function useWantedCaret(
  input: RefObject<HTMLTextAreaElement | null>,
  {tile: {slide}, box}: SlideBox,
  inList: boolean,
): void {
  const focus = useTextFocus();
  const wanted =
    inList && focus?.id === slide.id && focus.box === box ? focus : null;
  useLayoutEffect(() => {
    const node = input.current;
    if (wanted === null || node === null) return;
    node.focus({preventScroll: true});
    node.setSelectionRange(wanted.at, wanted.at);
    clearTextFocus();
  }, [input, wanted]);
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
  const many = takesManyRows(theme, box);
  const readOnly = deck.readOnly || locked;
  const input = useRef<HTMLTextAreaElement>(null);
  // NOTE(0913vision): The value goes into the box before the wanted caret is
  // placed in it, as both run after the same render.
  const shown = useTypedValue(input, value);
  useWantedCaret(input, place, inList);
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
    if (isComposing(event)) return;
    // NOTE(0913vision): A one-row box holds no line break, so Shift+Enter
    // leaves it as Enter does instead of typing a space.
    const enter =
      event.key === 'Enter' &&
      !many &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey;
    const escape = event.key === 'Escape' && !inList && !hasModifier(event);
    if (!enter && !escape) return;
    event.preventDefault();
    event.stopPropagation();
    focusSlides();
  };
  return (
    <textarea
      ref={input}
      id={id}
      data-slide-field={slide.id}
      data-slide-box={box}
      aria-label={label}
      className={classNames(field.textarea, styles.input)}
      rows={many ? Math.max(1, value.split('\n').length) : 1}
      maxLength={SLIDE_LIMITS.text}
      defaultValue={shown.initial}
      placeholder={filledText(theme, tile, box)}
      readOnly={readOnly}
      spellCheck={false}
      onChange={event => {
        if (readOnly) return;
        set(event.currentTarget.value);
        shown.typed(event.currentTarget.value);
      }}
      onKeyDown={keyDown}
    />
  );
}
