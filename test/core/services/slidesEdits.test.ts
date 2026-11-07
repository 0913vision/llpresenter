import {describe, expect, it, vi} from 'vitest';
import {createServiceItemId, createThemeId} from '@core/schema/ids';
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
