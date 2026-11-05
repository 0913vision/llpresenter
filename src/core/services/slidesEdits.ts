import {createSlideId} from '../schema/ids';
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
    this.current = {item, selected: 0};
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
    this.current = {...this.current, selected};
  }
  endTyping(): void {
    this.typing = undefined;
  }
  change(
    item: SlidesItem,
    selected = this.current.selected,
    typing?: string,
  ): void {
    if (JSON.stringify(item) === JSON.stringify(this.current.item)) return;
    if (typing === undefined || this.typing !== typing) {
      this.past.push(this.current);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
    }
    this.future = [];
    this.typing = typing;
    this.current = {item, selected};
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
    const {item, selected} = this.current;
    if (
      slides.length === 0 ||
      item.slides.slides.length + slides.length > SLIDES_LIMIT
    ) {
      return false;
    }
    const at = Math.min(selected + 1, item.slides.slides.length);
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
