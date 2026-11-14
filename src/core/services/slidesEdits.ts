import {createSlideId, type SlideId} from '../schema/ids';
import {copySlideList, type SlideListCommand} from '../songs/slideListEdits';
import {
  selectSlideList,
  slideInsertionIndex,
  type SlideListSelection,
  type SlideSelectionAction,
} from '../songs/slideListSelection';
import {slideRowsAdapter} from './slideRows';
import type {ServiceItemOf} from '../schema/service';
import {SLIDES_LIMITS} from '../schema/service';
import {SlideListClipboard, SlideListModel} from '../songs/slideListModel';
import {TYPING_PAUSE_MS} from '../songs/songHistory';

export type SlidesItem = ServiceItemOf<'slides'>;
export type Slide = SlidesItem['slides']['slides'][number];
export const SLIDES_LIMIT = SLIDES_LIMITS.slides;

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
    },
  };
}

interface Snapshot {
  readonly item: SlidesItem;
  readonly selected: number;
  readonly selection: SlideListSelection<SlideId>;
}

type SlidesFields = Omit<SlidesItem, 'slides'> & {
  readonly slides: Omit<SlidesItem['slides'], 'slides'>;
};

function fieldsOf(item: SlidesItem): SlidesFields {
  const {slides: rows, ...slides} = item.slides;
  return {...item, slides};
}

function serializedItem(item: SlidesItem): string {
  const fields = fieldsOf(item);
  return JSON.stringify({
    ...fields,
    slides: {...fields.slides, slides: item.slides.slides},
  });
}

/** One adapter to the shared list model, including item fields in the same history. */
export class SlidesDraft {
  readonly model: SlideListModel<Slide, SlidesFields>;
  private readonly snapshots = new WeakMap<object, Snapshot>();
  private typing: {readonly key: string; readonly time: number} | undefined;
  private saved: string;
  private savedItem: SlidesItem;
  private lastSelected = 0;

  constructor(
    item: SlidesItem,
    readonly clipboard = new SlideListClipboard<Slide>(),
  ) {
    this.saved = serializedItem(item);
    this.savedItem = item;
    this.model = new SlideListModel({
      slides: item.slides.slides,
      adapter: slideRowsAdapter(item.slides.form),
      clipboard,
      context: fieldsOf(item),
    });
    this.select(0);
  }

  get snapshot(): Snapshot {
    const state = this.model.getContent();
    const cached = this.snapshots.get(state);
    if (cached !== undefined) return cached;
    const fields = state.context ?? fieldsOf(this.savedItem);
    const item = {...fields, slides: {...fields.slides, slides: state.slides}};
    const focus = state.selection.focus;
    const selected = Math.max(
      0,
      Math.min(
        state.slides.length - 1,
        focus?.kind === 'slide'
          ? state.slides.findIndex(slide => slide.id === focus.id)
          : (state.selection.caret ?? this.lastSelected),
      ),
    );
    this.lastSelected = selected;
    const snapshot = {item, selected, selection: state.selection};
    this.snapshots.set(state, snapshot);
    return snapshot;
  }
  get dirty(): boolean {
    return serializedItem(this.snapshot.item) !== this.saved;
  }
  get base(): SlidesItem {
    return this.savedItem;
  }
  matchesSaved(item: SlidesItem): boolean {
    return serializedItem(item) === this.saved;
  }
  get canUndo(): boolean {
    return this.model.getSnapshot().canUndo;
  }
  get canRedo(): boolean {
    return this.model.getSnapshot().canRedo;
  }
  select(selected: number): void {
    const slide = this.model.getSnapshot().slides[selected];
    this.selectRows(
      slide === undefined ? {type: 'clear'} : {type: 'click', id: slide.id},
    );
  }
  selectRows(action: SlideSelectionAction<SlideId>): void {
    this.endTyping();
    this.model.select(action);
  }
  copyRows() {
    return copySlideList(
      this.model.getSnapshot(),
      slideRowsAdapter(this.snapshot.item.slides.form),
    );
  }
  commandRows(command: SlideListCommand<Slide>): boolean {
    this.endTyping();
    return this.model.command(command).ok;
  }
  pasteText(text: unknown): boolean {
    this.endTyping();
    return this.model.pasteText(text).ok;
  }
  endTyping(): void {
    this.typing = undefined;
  }
  change(
    item: SlidesItem,
    selected = this.snapshot.selected,
    typing?: string,
  ): void {
    if (serializedItem(item) === serializedItem(this.snapshot.item)) return;
    const time = Date.now();
    const coalesce =
      typing !== undefined &&
      this.typing?.key === typing &&
      time >= this.typing.time &&
      time - this.typing.time < TYPING_PAUSE_MS;
    const state = this.model.getSnapshot();
    const slide = item.slides.slides[selected];
    const result = this.model.edit(
      {
        ...state,
        slides: item.slides.slides,
        context: fieldsOf(item),
        selection:
          typing !== undefined || slide === undefined
            ? state.selection
            : selectSlideList(
                item.slides.slides.map(slide => slide.id),
                state.selection,
                {type: 'click', id: slide.id},
              ),
      },
      coalesce,
    );
    if (result.ok) {
      this.typing = typing === undefined ? undefined : {key: typing, time};
    }
  }
  add(slide: Slide): void {
    const item = this.snapshot.item;
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
    const item = this.snapshot.item;
    if (
      slides.length === 0 ||
      item.slides.slides.length + slides.length > SLIDES_LIMIT
    ) {
      return false;
    }
    const at = slideInsertionIndex(
      item.slides.slides.map(slide => slide.id),
      this.snapshot.selection,
    );
    const before = this.model.getContent();
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
    return this.model.getContent() !== before;
  }
  remove(index: number): void {
    const slide = this.snapshot.item.slides.slides[index];
    if (slide === undefined) return;
    this.selectRows({type: 'click', id: slide.id});
    this.commandRows({type: 'delete'});
  }
  move(from: number, to: number): void {
    const rows = this.snapshot.item.slides.slides;
    if (from === to || to < 0 || to >= rows.length) return;
    const slide = rows[from];
    if (slide === undefined) return;
    this.selectRows({type: 'click', id: slide.id});
    this.commandRows({type: 'move', index: to > from ? to + 1 : to});
  }
  undo(): void {
    this.endTyping();
    this.model.undo();
  }
  redo(): void {
    this.endTyping();
    this.model.redo();
  }
  markSaved(item: SlidesItem, endTyping = true): void {
    if (endTyping) this.endTyping();
    this.saved = serializedItem(item);
    this.savedItem = item;
  }
}
