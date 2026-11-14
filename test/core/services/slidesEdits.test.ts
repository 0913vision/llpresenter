import {describe, expect, it, vi} from 'vitest';
import {
  createMediaId,
  createSlideId,
  createServiceItemId,
  createThemeId,
} from '@core/schema/ids';
import {newSectionCard} from '@core/services/sectionCards';
import {withItemTheme} from '@core/services/itemFieldChanges';
import {
  newSlidesItem,
  newTextSlide,
  SlidesDraft,
  SLIDES_LIMIT,
  mergeSlidesChanges,
} from '@core/services/slidesEdits';

const id = createServiceItemId('00000000-0000-4000-8000-000000000001');

describe('merge slides changes', () => {
  it('clears locally removed optional fields while retaining fresh unrelated item and slides properties', () => {
    const base = {
      ...newSlidesItem('ad', id),
      slides: {...newSlidesItem('ad', id).slides, advance: 8},
      theme: createThemeId('00000000-0000-4000-8000-000000000002'),
    };
    const {theme, ...withoutTheme} = base;
    expect(theme).toBeDefined();
    const {advance, ...withoutAdvance} = base.slides;
    expect(advance).toBe(8);
    const edited = {...withoutTheme, slides: withoutAdvance};
    const fresh = {
      ...base,
      memo: 'Fresh memo',
      future: true,
      slides: {...base.slides, name: 'Fresh name', future: 1},
    };
    const result = mergeSlidesChanges(base, edited, fresh);
    expect(result).toMatchObject({
      memo: 'Fresh memo',
      future: true,
      slides: {name: 'Fresh name', future: 1},
    });
    expect(result).not.toHaveProperty('theme');
    expect(result?.slides).not.toHaveProperty('advance');
  });

  it('merges a card theme change with fresh card text and rejects competing card theme changes', () => {
    const card = newSectionCard();
    const base = {
      ...newSlidesItem('blank', id),
      sectionCard: card,
      theme: card.theme,
    };
    const selected = createThemeId('00000000-0000-4000-8000-000000000002');
    const edited = withItemTheme(base, selected, undefined);
    const fresh = {...base, sectionCard: {...card, name: 'Fresh name'}};
    expect(mergeSlidesChanges(base, edited, fresh)).toMatchObject({
      theme: selected,
      sectionCard: {name: 'Fresh name', theme: selected},
    });
    const other = createThemeId('00000000-0000-4000-8000-000000000003');
    expect(
      mergeSlidesChanges(base, edited, {
        ...fresh,
        sectionCard: {...fresh.sectionCard, theme: other},
      }),
    ).toBeNull();
  });

  it('merges a card transition together with slide transitions without losing fresh card text', () => {
    const base = {...newSlidesItem('blank', id), sectionCard: newSectionCard()};
    const effect = {kind: 'wipe' as const, sec: 1, dir: 'left' as const};
    const edited = {
      ...base,
      sectionCard: {...base.sectionCard, transition: effect},
      slides: {
        ...base.slides,
        slides: base.slides.slides.map(slide => ({
          ...slide,
          transition: effect,
        })),
      },
    };
    const fresh = {...base, sectionCard: {...base.sectionCard, name: 'Fresh'}};
    const merged = mergeSlidesChanges(base, edited, fresh);
    expect(merged?.sectionCard).toMatchObject({
      name: 'Fresh',
      transition: effect,
    });
    expect(merged?.slides.slides[0]?.transition).toEqual(effect);
    const draft = new SlidesDraft(base);
    draft.change(edited, 0, 'transition-all');
    draft.endTyping();
    draft.undo();
    expect(draft.snapshot.item.sectionCard?.transition).toBeUndefined();
    expect(draft.snapshot.item.slides.slides[0]?.transition).toBeUndefined();
  });

  it('accepts identical concurrent changes and refuses incompatible forms', () => {
    const base = newSlidesItem('ad', id);
    const edited = {...base, slides: {...base.slides, name: 'Same'}};
    expect(mergeSlidesChanges(base, edited, edited)).toEqual(edited);
    expect(
      mergeSlidesChanges(base, edited, newSlidesItem('blank', id)),
    ).toBeNull();
  });
});

describe('slides draft', () => {
  it('starts another shared undo step after a one-second typing pause', () => {
    const item = newSlidesItem('blank', id);
    const draft = new SlidesDraft(item);
    const time = vi.spyOn(Date, 'now');
    try {
      time.mockReturnValue(1000);
      draft.change({...item, slides: {...item.slides, name: 'A'}}, 0, 'name');
      time.mockReturnValue(1500);
      draft.change({...item, slides: {...item.slides, name: 'AB'}}, 0, 'name');
      time.mockReturnValue(2500);
      draft.change({...item, slides: {...item.slides, name: 'ABC'}}, 0, 'name');
      draft.undo();
      expect(draft.snapshot.item.slides.name).toBe('AB');
      draft.undo();
      expect(draft.dirty).toBe(false);
    } finally {
      time.mockRestore();
    }
  });

  it('inserts a range after selection as one history step and refuses an over-cap range atomically', () => {
    const item = newSlidesItem('blank', id);
    const draft = new SlidesDraft(item);
    draft.add(newTextSlide('blank'));
    draft.select(0);
    const before = draft.snapshot.item;
    const added = [newTextSlide('blank'), newTextSlide('blank')];
    expect(draft.insert(added)).toBe(true);
    expect(draft.snapshot.item.slides.slides.slice(1, 3)).toEqual(added);
    expect(draft.snapshot.selected).toBe(1);
    draft.undo();
    expect(draft.snapshot.item).toBe(before);
    draft.redo();
    expect(draft.snapshot.item.slides.slides.slice(1, 3)).toEqual(added);
    const full = new SlidesDraft({
      ...item,
      slides: {
        ...item.slides,
        slides: Array.from({length: SLIDES_LIMIT - 1}, () =>
          newTextSlide('blank'),
        ),
      },
    });
    const snapshot = full.snapshot;
    expect(full.insert(added)).toBe(false);
    expect(full.snapshot).toBe(snapshot);
    expect(full.dirty).toBe(false);
  });
  it('reorders and removes slides, and restores their selection with undo and redo', () => {
    const first = newSlidesItem('ad', id);
    const draft = new SlidesDraft(first);
    draft.add(newTextSlide('ad'));
    const second = draft.snapshot.item.slides.slides[1];
    draft.move(1, 0);
    expect(draft.snapshot.item.slides.slides[0]).toEqual(second);
    draft.remove(0);
    expect(draft.snapshot.item.slides.slides).toEqual(first.slides.slides);
    draft.undo();
    expect(draft.snapshot.item.slides.slides[0]).toEqual(second);
    expect(draft.snapshot.selected).toBe(0);
    draft.redo();
    expect(draft.snapshot.item.slides.slides).toHaveLength(1);
  });
  it('groups a typing session and starts a fresh undo step after blur', () => {
    const item = newSlidesItem('blank', id);
    const draft = new SlidesDraft(item);
    draft.change({...item, slides: {...item.slides, name: 'A'}}, 0, 'name');
    draft.change({...item, slides: {...item.slides, name: 'AB'}}, 0, 'name');
    draft.endTyping();
    draft.change({...item, slides: {...item.slides, name: 'ABC'}}, 0, 'name');
    draft.undo();
    expect(draft.snapshot.item.slides.name).toBe('AB');
    draft.undo();
    expect(draft.dirty).toBe(false);
    draft.redo();
    draft.markSaved(draft.snapshot.item);
    expect(draft.dirty).toBe(false);
    draft.undo();
    expect(draft.dirty).toBe(true);
  });
  it('caps slide growth and allows an empty item without invalid movement', () => {
    const draft = new SlidesDraft(newSlidesItem('blank', id));
    for (let at = 0; at <= SLIDES_LIMIT; at++) draft.add(newTextSlide('blank'));
    expect(draft.snapshot.item.slides.slides).toHaveLength(SLIDES_LIMIT);
    const before = draft.snapshot;
    draft.move(-1, 0);
    expect(draft.snapshot).toBe(before);
    const empty = new SlidesDraft(newSlidesItem('ad', id));
    empty.remove(0);
    expect(empty.snapshot.item.slides.slides).toEqual([]);
    empty.undo();
    expect(empty.dirty).toBe(false);
  });
});

it('creates advertisements with manual advance and looping off', () => {
  const item = newSlidesItem('ad', id);
  expect(item.slides.advance).toBeUndefined();
  expect(item.slides.loop ?? false).toBe(false);
});

it('applies and removes a label on multiple selected text and picture slides', () => {
  const first = newSlidesItem('blank', id);
  const draft = new SlidesDraft(first);
  const picture = {
    id: createSlideId('00000000-0000-4000-8000-000000000055'),
    media: createMediaId('00000000-0000-4000-8000-000000000056'),
  };
  draft.add(picture);
  const text = draft.snapshot.item.slides.slides[0];
  if (!text) throw Error('Missing slide');
  draft.selectRows({type: 'click', id: text.id});
  draft.selectRows({type: 'click', id: picture.id, ctrl: true});
  expect(draft.commandRows({type: 'label', label: 'Verse'})).toBe(true);
  expect(draft.snapshot.item.slides.slides.map(slide => slide.label)).toEqual([
    'Verse',
    'Verse',
  ]);
  expect(draft.commandRows({type: 'label', label: undefined})).toBe(true);
  expect(draft.snapshot.item.slides.slides.map(slide => slide.label)).toEqual([
    undefined,
    undefined,
  ]);
});
