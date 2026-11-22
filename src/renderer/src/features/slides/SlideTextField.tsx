import {
  useId,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {SLIDE_LIMITS} from '@core/schema/slide';
import type {ShowTile} from '@core/schema/showService';
import type {ThemeFile} from '@core/schema/theme';
import {tileContent} from '@core/presentation/slideLayer';
import {changeSlides, withNext, withText} from '@core/slides/edits';
import {
  joinSlide,
  pasteSlideText,
  splitSlide,
  type TextEdit,
} from '@core/slides/textEdits';
import {contentValues, nextPhraseOf} from '@core/theme/content';
import {slideMaking} from '@renderer/platform/themes';
import {classNames} from '@renderer/ui/classNames';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import field from '@renderer/ui/TextField.module.css';
import {clearTextFocus, focusText, useTextFocus} from './deckSelection';
import type {SlideDeck} from './slideDeck';
import {NEXT_BOX} from './slideColumns';
import styles from './SlideTextField.module.css';

function edit(deck: SlideDeck, box: string, change: TextEdit | null): boolean {
  if (change === null || deck.readOnly) return false;
  deck.edit(() => change.slides);
  focusText(deck.id, {...change.caret, box});
  return true;
}

/** Splits the slide whose text has the caret, where the caret is. */
export function splitAtCaret(
  deck: SlideDeck,
  input: HTMLTextAreaElement,
): boolean {
  const {slideField, slideBox} = input.dataset;
  const slide = deck.slides.find(entry => entry.id === slideField);
  if (slide === undefined || slideBox === undefined || slideBox === NEXT_BOX) {
    return false;
  }
  return edit(
    deck,
    slideBox,
    splitSlide(slideMaking(), deck.slides, {
      id: slide.id,
      box: slideBox,
      start: input.selectionStart,
      end: input.selectionEnd,
    }),
  );
}

/** What shows on the slide while the field is empty. */
function placeholderOf(
  tile: ShowTile,
  theme: ThemeFile,
  {box, first}: {readonly box: string; readonly first: boolean},
): string | undefined {
  if (box === NEXT_BOX) {
    return nextPhraseOf(theme, tileContent(tile), first) ?? undefined;
  }
  return contentValues(theme, {texts: {}, auto: tile.auto})(box);
}

/** The text of one box of a slide, or the text its slide before shows. */
export function SlideTextField({
  deck,
  tile,
  theme,
  box: name,
  alone = false,
  inList = false,
}: {
  readonly deck: SlideDeck;
  readonly tile: ShowTile;
  readonly theme: ThemeFile;
  readonly box: string;
  /** The only field of its slide, so its name says nothing. */
  readonly alone?: boolean;
  readonly inList?: boolean;
}): JSX.Element {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const {slide} = tile;
  const box = theme.boxes.find(entry => entry.name === name);
  const value =
    name === NEXT_BOX ? (slide.next ?? '') : (slide.texts[name] ?? '');
  const many = box?.rows === 'many';
  const focus = useTextFocus();
  const wanted =
    inList && focus?.id === slide.id && focus.box === name ? focus : null;
  useLayoutEffect(() => {
    const node = input.current;
    if (wanted === null || node === null) return;
    node.focus({preventScroll: true});
    node.setSelectionRange(wanted.at, wanted.at);
    clearTextFocus();
  }, [wanted]);

  const set = (text: string): void => {
    const own = many ? text : text.replace(/\s*\n\s*/gu, ' ');
    deck.edit(
      slides =>
        changeSlides(slides, new Set([slide.id]), entry =>
          name === NEXT_BOX ? withNext(entry, own) : withText(entry, name, own),
        ),
      `text:${slide.id}:${name}`,
    );
  };
  // NOTE(0913vision): A slide that says one thing goes over several slides when
  // its text does; a slide with a title of its own keeps every row.
  const flows =
    many &&
    inList &&
    !deck.readOnly &&
    theme.boxes.every(
      other =>
        other.name === name ||
        other.default !== undefined ||
        (slide.texts[other.name] ?? '') === '',
    );
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (isComposing(event) || hasModifier(event)) return;
    if (event.key === 'Enter' && !many) {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (!flows) return;
    const {selectionStart: start, selectionEnd: end} = event.currentTarget;
    if (event.key === 'Backspace' && start === 0 && end === 0) {
      if (edit(deck, name, joinSlide(deck.slides, slide.id, name))) {
        event.preventDefault();
      }
      return;
    }
    const up = event.key === 'ArrowUp';
    if (start !== end || (!up && event.key !== 'ArrowDown')) return;
    const before = value.slice(0, start);
    if (up ? before.includes('\n') : value.slice(end).includes('\n')) return;
    const index = deck.slides.findIndex(entry => entry.id === slide.id);
    const target = deck.slides[up ? index - 1 : index + 1];
    if (target?.theme !== slide.theme) return;
    const text = target.texts[name] ?? '';
    const rowStart = up ? text.lastIndexOf('\n') + 1 : 0;
    const row = text.slice(rowStart).split('\n')[0] ?? '';
    const column = start - (before.lastIndexOf('\n') + 1);
    event.preventDefault();
    focusText(deck.id, {
      id: target.id,
      box: name,
      at: rowStart + Math.min(column, row.length),
    });
  };
  const paste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    if (!flows) return;
    const pasted = event.clipboardData
      .getData('text/plain')
      .replace(/\r\n?/gu, '\n');
    if (!/\n[^\S\n]*\n/u.test(pasted)) return;
    const {selectionStart: start, selectionEnd: end} = event.currentTarget;
    const place = {id: slide.id, box: name, start, end, pasted};
    if (edit(deck, name, pasteSlideText(slideMaking(), deck.slides, place))) {
      event.preventDefault();
    }
  };
  const first = deck.slides[0]?.id === slide.id;
  return (
    <div className={styles.field} data-alone={(alone && inList) || undefined}>
      {alone ? null : <label htmlFor={id}>{name}</label>}
      <textarea
        ref={input}
        id={id}
        data-slide-field={slide.id}
        data-slide-box={name}
        aria-label={alone ? name : undefined}
        className={classNames(field.textarea, styles.input)}
        rows={many ? Math.max(1, value.split('\n').length) : 1}
        maxLength={SLIDE_LIMITS.text}
        value={value}
        placeholder={placeholderOf(tile, theme, {box: name, first})}
        readOnly={deck.readOnly}
        spellCheck={false}
        onChange={event => {
          if (!deck.readOnly) set(event.currentTarget.value);
        }}
        onKeyDown={keyDown}
        onPaste={paste}
      />
    </div>
  );
}
