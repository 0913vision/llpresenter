import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import type {SlideListItem} from '@core/songs/slideListEdits';
import type {SlideListView} from '@core/songs/slideListModel';
import type {SlideListSession} from './slideListSession';

export type ItemEditorKind =
  'song' | 'blank' | 'ad' | 'bible' | 'sermon' | 'liturgy' | 'media' | 'header';

/** The commands an item editor can offer, independent of its current locks. */
export interface ItemEditorCapabilities {
  readonly kind: ItemEditorKind;
  readonly addSlide: boolean;
  readonly addPicture: boolean;
  readonly addVerse: boolean;
  readonly addTitle: boolean;
  readonly splitVerses: boolean;
  readonly timedAdvance: boolean;
}

export function itemEditorAdapter(item: ServiceItem): ItemEditorCapabilities {
  const kind: ItemEditorKind = isItemOfKind(item, 'slides')
    ? item.slides.form
    : isItemOfKind(item, 'song')
      ? 'song'
      : isItemOfKind(item, 'bible')
        ? 'bible'
        : isItemOfKind(item, 'sermon')
          ? 'sermon'
          : isItemOfKind(item, 'liturgy')
            ? 'liturgy'
            : isItemOfKind(item, 'media')
              ? 'media'
              : 'header';
  return editorCapabilities(kind);
}

/** Capabilities shared by all editors for the same item kind. */
export function editorCapabilities(
  kind: ItemEditorKind,
): ItemEditorCapabilities {
  return {
    kind,
    addSlide: kind === 'song' || kind === 'blank' || kind === 'ad',
    addPicture: kind === 'blank' || kind === 'ad',
    addVerse: kind === 'blank',
    addTitle: ['song', 'blank', 'ad', 'bible'].includes(kind),
    splitVerses: kind === 'bible',
    timedAdvance: kind === 'blank' || kind === 'ad',
  };
}

export type ItemEditorIdentity<Id extends string> =
  | {readonly kind: 'card'; readonly itemId: string}
  | {readonly kind: 'slide'; readonly itemId: string; readonly slideId: Id};

export type ItemEditorEntry<T extends SlideListItem> =
  | {
      readonly identity: ItemEditorIdentity<T['id']> & {readonly kind: 'card'};
      readonly selected: boolean;
    }
  | {
      readonly identity: ItemEditorIdentity<T['id']> & {readonly kind: 'slide'};
      readonly selected: boolean;
      readonly slide: T;
    };

/** Adapts the existing slide session without owning a second selection or history. */
export interface ItemEditorAdapter<T extends SlideListItem> {
  readonly kind: ItemEditorKind;
  readonly itemId: string;
  readonly capabilities: ItemEditorCapabilities;
  readonly entries: ReadonlyArray<ItemEditorEntry<T>>;
  readonly selectedSlideIds: ReadonlySet<T['id']>;
  readonly focusedIndex: number | null;
  readonly readOnly: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly session: SlideListSession<T>;
  preview(
    identity: ItemEditorIdentity<T['id']>,
    role: 'audience' | 'broadcast' | 'stage',
  ): {
    readonly identity: ItemEditorIdentity<T['id']>;
    readonly role: 'audience' | 'broadcast' | 'stage';
  };
}

export function adaptItemEditor<T extends SlideListItem>(options: {
  readonly kind: ItemEditorKind;
  readonly session: SlideListSession<T>;
  readonly view: SlideListView<T>;
  readonly hasCard: boolean;
  readonly cardSelected: boolean;
  readonly blocked: boolean;
}): ItemEditorAdapter<T> {
  const {kind, session, view, hasCard, cardSelected, blocked} = options;
  const itemId = session.slideDocumentId;
  return {
    kind,
    itemId,
    capabilities: editorCapabilities(kind),
    get entries() {
      const entries: Array<ItemEditorEntry<T>> = [];
      if (hasCard) {
        entries.push({
          identity: {kind: 'card', itemId},
          selected: cardSelected,
        });
      }
      for (const slide of view.slides) {
        entries.push({
          identity: {kind: 'slide', itemId, slideId: slide.id},
          selected: view.selection.ids.has(slide.id),
          slide,
        });
      }
      return entries;
    },
    selectedSlideIds: view.selection.ids,
    get focusedIndex() {
      const focus = view.selection.focus;
      const index =
        focus?.kind === 'slide'
          ? view.slides.findIndex(slide => slide.id === focus.id)
          : -1;
      return cardSelected && index < 0
        ? 0
        : index < 0
          ? null
          : index + Number(hasCard);
    },
    readOnly: blocked || session.readOnly,
    canUndo: session.canUndo ?? view.canUndo,
    canRedo: session.canRedo ?? view.canRedo,
    session,
    preview: (identity, role) => ({identity, role}),
  };
}
