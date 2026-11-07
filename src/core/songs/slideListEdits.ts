import type {Result} from '../common/result';
import {checkPart} from '../schema/fileFormat';
import {
  SLIDE_CLIPBOARD_LIMITS,
  slideClipboardTextSchema,
} from '../schema/slideClipboard';
import {SONG_LIMITS} from '../schema/song';
import {
  emptySlideSelection,
  selectSlideList,
  slideInsertionIndex,
  type SlideListSelection,
} from './slideListSelection';

export interface SlideListItem {
  readonly id: string;
  readonly hotKey?: string;
  readonly label?: string;
}
export type SlideListError = 'invalid' | 'limit';
type MutableSlide<T> = {-readonly [Key in keyof T]: T[Key]};

/** The owning document supplies its schema and text conversion, without UI or I/O. */
export interface SlideListAdapter<T extends SlideListItem> {
  readonly newId: () => T['id'];
  readonly fromLines: (lines: readonly string[], id: T['id']) => T;
  readonly toLines: (slide: T) => readonly string[];
  readonly validate: (
    slides: readonly T[],
  ) => Result<readonly T[], SlideListError>;
  readonly minSlides: number;
  readonly maxSlides: number;
}
export interface SlideListSnapshot<T extends SlideListItem> {
  readonly slides: readonly T[];
  readonly selection: SlideListSelection<T['id']>;
}
export interface SlideClipboard<T extends SlideListItem> {
  readonly slides: readonly T[];
  readonly text: string;
}
export type SlideListCommand<T extends SlideListItem> =
  | {readonly type: 'paste'; readonly slides: readonly T[]}
  | {readonly type: 'duplicate'}
  | {readonly type: 'delete'}
  | {readonly type: 'move'; readonly index: number}
  | {readonly type: 'label'; readonly label: string | undefined};

export function validateSlideList<T extends SlideListItem>(
  slides: readonly T[],
  adapter: SlideListAdapter<T>,
): Result<readonly T[], SlideListError> {
  if (slides.length < adapter.minSlides || slides.length > adapter.maxSlides) {
    return {ok: false, error: 'limit'};
  }
  const ids = new Set(slides.map(slide => slide.id));
  const keys = slides.flatMap(slide =>
    slide.hotKey === undefined ? [] : [slide.hotKey],
  );
  if (ids.size !== slides.length || new Set(keys).size !== keys.length) {
    return {ok: false, error: 'invalid'};
  }
  return adapter.validate(slides);
}

/** Copies are deep snapshots; every pasted copy loses its source hot key. */
function freshCopies<T extends SlideListItem>(
  slides: readonly T[],
  newId: () => T['id'],
): readonly T[] {
  return slides.map(slide => {
    const copy: MutableSlide<T> = structuredClone(slide);
    delete copy.hotKey;
    return {...copy, id: newId()};
  });
}

export function copySlideList<T extends SlideListItem>(
  snapshot: SlideListSnapshot<T>,
  adapter: SlideListAdapter<T>,
): Result<SlideClipboard<T> | null, SlideListError> {
  const selected = snapshot.slides.filter(slide =>
    snapshot.selection.ids.has(slide.id),
  );
  if (selected.length === 0) return {ok: true, value: null};
  const text = selected
    .map(slide => adapter.toLines(slide).join('\n'))
    .join('\n\n');
  if (
    text.length > SLIDE_CLIPBOARD_LIMITS.characters ||
    selected.length > SLIDE_CLIPBOARD_LIMITS.slides
  ) {
    return {ok: false, error: 'limit'};
  }
  return {ok: true, value: {slides: structuredClone(selected), text}};
}

/** Plain text has no labels; whitespace-only lines separate slides, CRLF is normalized. */
export function slidesFromPlainText<T extends SlideListItem>(
  text: unknown,
  adapter: SlideListAdapter<T>,
): Result<readonly T[], SlideListError> {
  const checked = checkPart(slideClipboardTextSchema, text);
  if (!checked.ok) return {ok: false, error: 'invalid'};
  const groups: string[][] = [];
  let lines: string[] = [];
  for (const line of checked.value.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() !== '') lines.push(line);
    else if (lines.length > 0) {
      groups.push(lines);
      lines = [];
    }
  }
  if (lines.length > 0) groups.push(lines);
  if (
    groups.length > adapter.maxSlides ||
    groups.length > SLIDE_CLIPBOARD_LIMITS.slides
  ) {
    return {ok: false, error: 'limit'};
  }
  return {
    ok: true,
    value: groups.map(group => adapter.fromLines(group, adapter.newId())),
  };
}

function selectedSnapshot<T extends SlideListItem>(
  slides: readonly T[],
  selected: readonly T[],
): SlideListSnapshot<T> {
  const first = selected[0];
  const last = selected.at(-1);
  return {
    slides,
    selection:
      first === undefined || last === undefined
        ? emptySlideSelection()
        : {
            ids: new Set(selected.map(slide => slide.id)),
            anchor: {kind: 'slide', id: first.id},
            focus: {kind: 'slide', id: last.id},
            caret: null,
          },
  };
}

function changedSlides<T extends SlideListItem>(
  snapshot: SlideListSnapshot<T>,
  command: SlideListCommand<T>,
  adapter: SlideListAdapter<T>,
): Result<SlideListSnapshot<T>, SlideListError> {
  const {slides, selection} = snapshot;
  const selected = slides.filter(slide => selection.ids.has(slide.id));
  if (command.type !== 'paste' && selected.length === 0) {
    return {ok: true, value: snapshot};
  }
  if (command.type === 'paste' || command.type === 'duplicate') {
    const source = command.type === 'paste' ? command.slides : selected;
    if (source.length === 0) return {ok: true, value: snapshot};
    if (source.length + slides.length > adapter.maxSlides) {
      return {ok: false, error: 'limit'};
    }
    const index = slideInsertionIndex(
      slides.map(slide => slide.id),
      selection,
    );
    const copies = freshCopies(source, adapter.newId);
    const sourceIds = new Set(source.map(slide => slide.id));
    if (copies.some(slide => sourceIds.has(slide.id))) {
      return {ok: false, error: 'invalid'};
    }
    return {
      ok: true,
      value: selectedSnapshot(
        [...slides.slice(0, index), ...copies, ...slides.slice(index)],
        copies,
      ),
    };
  }
  if (command.type === 'delete') {
    const first = slides.findIndex(slide => selection.ids.has(slide.id));
    const kept = slides.filter(slide => !selection.ids.has(slide.id));
    return {
      ok: true,
      value: {
        slides: kept,
        selection: selectSlideList(
          kept.map(slide => slide.id),
          emptySlideSelection(),
          {type: 'gap', index: Math.min(first, kept.length)},
        ),
      },
    };
  }
  if (command.type === 'move') {
    if (
      !Number.isInteger(command.index) ||
      command.index < 0 ||
      command.index > slides.length
    ) {
      return {ok: false, error: 'invalid'};
    }
    const before = slides
      .slice(0, command.index)
      .filter(slide => !selection.ids.has(slide.id));
    const after = slides
      .slice(command.index)
      .filter(slide => !selection.ids.has(slide.id));
    return {
      ok: true,
      value: selectedSnapshot([...before, ...selected, ...after], selected),
    };
  }
  const label = command.label?.trim();
  if (label !== undefined && label.length > SONG_LIMITS.label) {
    return {ok: false, error: 'invalid'};
  }
  return {
    ok: true,
    value: {
      ...snapshot,
      slides: slides.map(slide => {
        if (
          !selection.ids.has(slide.id) ||
          slide.label === (label === '' ? undefined : label)
        ) {
          return slide;
        }
        const next: MutableSlide<T> = {...slide};
        delete next.label;
        return label ? {...next, label} : next;
      }),
    },
  };
}

/** Invalid edits are atomic. A destination for move is a gap in the original list. */
export function editSlideList<T extends SlideListItem>(
  snapshot: SlideListSnapshot<T>,
  command: SlideListCommand<T>,
  adapter: SlideListAdapter<T>,
): Result<SlideListSnapshot<T>, SlideListError> {
  const result = changedSlides(snapshot, command, adapter);
  if (!result.ok || result.value === snapshot) return result;
  const next = result.value;
  if (
    next.slides.length === snapshot.slides.length &&
    next.slides.every((slide, index) => slide === snapshot.slides[index])
  ) {
    return {ok: true, value: snapshot};
  }
  const checked = validateSlideList(next.slides, adapter);
  return checked.ok
    ? {ok: true, value: {...next, slides: checked.value}}
    : checked;
}
