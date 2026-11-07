import {createSlideId, type SlideId} from '../schema/ids';
import {
  copySlideList,
  editSlideList,
  slidesFromPlainText,
  type SlideListCommand,
} from '../songs/slideListEdits';
import {
  emptySlideSelection,
  selectSlideList,
  slideInsertionIndex,
  type SlideListSelection,
  type SlideSelectionAction,
} from '../songs/slideListSelection';
import {slideRowsAdapter} from './slideRows';
import type {ServiceItemOf} from '../schema/service';
import {SLIDES_LIMITS} from '../schema/service';

export type SlidesItem = ServiceItemOf<'slides'>;
export type Slide = SlidesItem['slides']['slides'][number];
export const SLIDES_LIMIT = SLIDES_LIMITS.slides;
const HISTORY_LIMIT = 100;

const MERGE_CONFLICT = Symbol('slides-conflict');

function mergeValue<T>(
  base: T,
  edited: T,
  fresh: T,
): T | typeof MERGE_CONFLICT {
  const before = JSON.stringify(base);
  const next = JSON.stringify(edited);
  if (before === next) return fresh;
  const latest = JSON.stringify(fresh);
  return latest !== before && latest !== next ? MERGE_CONFLICT : edited;
}

/** Applies editor changes to fresh fields, refusing concurrent changes to the same field. */
export function mergeSlidesChanges(
  base: SlidesItem,
  edited: SlidesItem,
  fresh: SlidesItem,
): SlidesItem | null {
  if (
    base.id !== edited.id ||
    base.id !== fresh.id ||
    base.slides.form !== fresh.slides.form ||
    base.slides.form !== edited.slides.form
  ) {
    return null;
  }
  const name = mergeValue(
    base.slides.name,
    edited.slides.name,
    fresh.slides.name,
  );
  const advance = mergeValue(
    base.slides.advance,
    edited.slides.advance,
    fresh.slides.advance,
  );
  const loop = mergeValue(
    base.slides.loop,
    edited.slides.loop,
    fresh.slides.loop,
  );
  const slides = mergeValue(
    base.slides.slides,
    edited.slides.slides,
    fresh.slides.slides,
  );
  const theme = mergeValue(base.theme, edited.theme, fresh.theme);
  if (
    name === MERGE_CONFLICT ||
    advance === MERGE_CONFLICT ||
    loop === MERGE_CONFLICT ||
    slides === MERGE_CONFLICT ||
    theme === MERGE_CONFLICT
  ) {
    return null;
  }
  const merged = {...fresh, slides: {...fresh.slides, name, slides}};
  if (advance === undefined) delete merged.slides.advance;
  else merged.slides.advance = advance;
  if (loop === undefined) delete merged.slides.loop;
  else merged.slides.loop = loop;
  if (theme === undefined) delete merged.theme;
  else merged.theme = theme;
  return merged;
}

export function newTextSlide(form: SlidesItem['slides']['form']): Slide {
  return {
    id: createSlideId(crypto.randomUUID()),
    text: '',
    ...(form === 'ad' ? {name: ''} : {}),
  };
}

export function newSlidesItem(
  form: SlidesItem['slides']['form'],
  id: SlidesItem['id'],
): SlidesItem {
  return {
    id,
    slides: {
      form,
      name: form === 'ad' ? '광고' : '빈 슬라이드',
      slides: [newTextSlide(form)],
      ...(form === 'ad' ? {advance: 8, loop: true} : {}),
    },
  };
}

interface Snapshot {
  readonly item: SlidesItem;
  readonly selected: number;
  readonly selection: SlideListSelection<SlideId>;
}

/** A bounded local draft; 저장 commits the whole item as one service edit. */
export class SlidesDraft {
  private readonly past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private typing: string | undefined;
  private saved: string;
  private savedItem: SlidesItem;
  private current: Snapshot;

  constructor(item: SlidesItem) {
    this.current = {item, selected: 0, selection: this.single(item, 0)};
    this.saved = JSON.stringify(item);
    this.savedItem = item;
  }

  get snapshot(): Snapshot {
    return this.current;
  }
  get dirty(): boolean {
    return JSON.stringify(this.current.item) !== this.saved;
  }
  get base(): SlidesItem {
    return this.savedItem;
  }
  select(selected: number): void {
    this.endTyping();
    this.current = {
      ...this.current,
      selected,
      selection: this.single(this.current.item, selected),
    };
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  selectRows(action: SlideSelectionAction<SlideId>): void {
    this.endTyping();
    const selection = selectSlideList(
      this.current.item.slides.slides.map(slide => slide.id),
      this.current.selection,
      action,
    );
    this.current = {
      ...this.current,
      selection,
      selected: this.focusIndex(selection),
    };
  }
  copyRows() {
    return copySlideList(
      {
        slides: this.current.item.slides.slides,
        selection: this.current.selection,
      },
      slideRowsAdapter(this.current.item.slides.form),
    );
  }
  commandRows(command: SlideListCommand<Slide>): boolean {
    const {item, selection} = this.current;
    const snapshot = {slides: item.slides.slides, selection};
    const result = editSlideList(
      snapshot,
      command,
      slideRowsAdapter(item.slides.form),
    );
    if (!result.ok) return false;
    if (result.value === snapshot) return true;
    this.commit({
      item: {...item, slides: {...item.slides, slides: result.value.slides}},
      selected: this.focusIndex(result.value.selection, result.value.slides),
      selection: result.value.selection,
    });
    return true;
  }
  pasteText(text: unknown): boolean {
    const result = slidesFromPlainText(
      text,
      slideRowsAdapter(this.current.item.slides.form),
    );
    return result.ok && this.commandRows({type: 'paste', slides: result.value});
  }
  private single(item: SlidesItem, index: number): SlideListSelection<SlideId> {
    const slide = item.slides.slides[index];
    return slide === undefined
      ? emptySlideSelection()
      : selectSlideList(
          item.slides.slides.map(slide => slide.id),
          emptySlideSelection(),
          {type: 'click', id: slide.id},
        );
  }
  private focusIndex(
    selection: SlideListSelection<SlideId>,
    slides = this.current.item.slides.slides,
  ): number {
    const focus = selection.focus;
    return Math.max(
      0,
      Math.min(
        slides.length - 1,
        focus?.kind === 'slide'
          ? slides.findIndex(slide => slide.id === focus.id)
          : (selection.caret ?? this.current.selected),
      ),
    );
  }
  endTyping(): void {
    this.typing = undefined;
  }
  change(
    item: SlidesItem,
    selected = this.current.selected,
    typing?: string,
  ): void {
    this.commit(
      {
        item,
        selected,
        selection:
          typing !== undefined
            ? this.current.selection
            : this.single(item, selected),
      },
      typing,
    );
  }
  private commit(next: Snapshot, typing?: string): void {
    if (JSON.stringify(next.item) === JSON.stringify(this.current.item)) return;
    if (typing === undefined || this.typing !== typing) {
      this.past.push(this.current);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
    }
    this.future = [];
    this.typing = typing;
    this.current = next;
  }
  add(slide: Slide): void {
    const {item} = this.current;
    if (item.slides.slides.length >= SLIDES_LIMIT) return;
    this.change(
      {
        ...item,
        slides: {...item.slides, slides: [...item.slides.slides, slide]},
      },
      item.slides.slides.length,
    );
  }
  insert(slides: readonly Slide[]): boolean {
    const {item} = this.current;
    if (
      slides.length === 0 ||
      item.slides.slides.length + slides.length > SLIDES_LIMIT
    ) {
      return false;
    }
    const at = slideInsertionIndex(
      item.slides.slides.map(slide => slide.id),
      this.current.selection,
    );
    this.change(
      {
        ...item,
        slides: {
          ...item.slides,
          slides: [
            ...item.slides.slides.slice(0, at),
            ...slides,
            ...item.slides.slides.slice(at),
          ],
        },
      },
      at,
    );
    return true;
  }
  remove(index: number): void {
    const {item} = this.current;
    if (item.slides.slides[index] === undefined) return;
    const slides = item.slides.slides.filter((_, at) => at !== index);
    this.change(
      {...item, slides: {...item.slides, slides}},
      Math.max(0, Math.min(index, slides.length - 1)),
    );
  }
  move(from: number, to: number): void {
    const {item} = this.current;
    const slides = [...item.slides.slides];
    if (
      from === to ||
      from < 0 ||
      from >= slides.length ||
      to < 0 ||
      to >= slides.length
    ) {
      return;
    }
    const [moved] = slides.splice(from, 1);
    if (moved === undefined) return;
    slides.splice(to, 0, moved);
    this.change({...item, slides: {...item.slides, slides}}, to);
  }
  undo(): void {
    this.endTyping();
    const previous = this.past.pop();
    if (previous === undefined) return;
    this.future.push(this.current);
    this.current = previous;
  }
  redo(): void {
    this.endTyping();
    const next = this.future.pop();
    if (next === undefined) return;
    this.past.push(this.current);
    this.current = next;
  }
  markSaved(item: SlidesItem): void {
    this.saved = JSON.stringify(item);
    this.savedItem = item;
  }
}
