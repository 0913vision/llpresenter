import {isItemOfKind, type ServiceItem} from '@core/schema/service';

export type ItemEditorKind =
  'song' | 'blank' | 'ad' | 'bible' | 'sermon' | 'liturgy' | 'media' | 'header';

/** The commands an item editor can offer, independent of its current locks. */
export interface ItemEditorAdapter {
  readonly kind: ItemEditorKind;
  readonly addSlide: boolean;
  readonly addPicture: boolean;
  readonly addVerse: boolean;
  readonly addTitle: boolean;
  readonly splitVerses: boolean;
  readonly timedAdvance: boolean;
}

export function itemEditorAdapter(item: ServiceItem): ItemEditorAdapter {
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
export function editorCapabilities(kind: ItemEditorKind): ItemEditorAdapter {
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
