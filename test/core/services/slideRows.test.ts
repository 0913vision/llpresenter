import {describe, expect, it} from 'vitest';
import {
  createServiceItemId,
  createSlideId,
  createMediaId,
  translationIdSchema,
} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import {
  SlidesDraft,
  newSlidesItem,
  type Slide,
} from '@core/services/slidesEdits';
import {slideRowsAdapter} from '@core/services/slideRows';
import {SlideListClipboard} from '@core/songs/slideListModel';

const slideId = (n: number) =>
  createSlideId(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
const itemId = createServiceItemId('10000000-0000-4000-8000-000000000001');
function setup(form: 'blank' | 'ad' = 'blank') {
  const item = newSlidesItem(form, itemId);
  const slides = [1, 2, 3, 4].map(n => ({
    id: slideId(n),
    text: `Line ${n}`,
    ...(form === 'ad' ? {name: `Name ${n}`} : {}),
  }));
  return new SlidesDraft({...item, slides: {...item.slides, slides}});
}

describe('slide rows in the item draft history', () => {
  it('shares the same model clipboard across item drafts without duplicating their headers', () => {
    const clipboard = new SlideListClipboard<Slide>();
    const item = newSlidesItem('ad', itemId);
    const source = new SlidesDraft(item, clipboard);
    const target = new SlidesDraft(
      {...item, slides: {...item.slides, name: 'Destination'}},
      clipboard,
    );
    expect(source.model.copy().ok).toBe(true);
    expect(target.model.paste().ok).toBe(true);
    expect(target.snapshot.item.slides.slides).toHaveLength(2);
    expect(target.snapshot.item.slides.name).toBe('Destination');
    target.undo();
    expect(target.snapshot.item.slides.slides).toHaveLength(1);
    expect(target.snapshot.item.slides.name).toBe('Destination');
  });

  it.each(['blank', 'ad'] as const)(
    'duplicates a %s selection with fresh IDs and undoes together with item and text edits',
    form => {
      const draft = setup(form);
      draft.selectRows({type: 'click', id: slideId(2)});
      draft.selectRows({type: 'click', id: slideId(4), ctrl: true});
      const before = draft.snapshot;
      expect(draft.commandRows({type: 'duplicate'})).toBe(true);
      const copied = draft.snapshot.item.slides.slides.slice(4);
      expect(copied.map(row => ('text' in row ? row.text : ''))).toEqual([
        'Line 2',
        'Line 4',
      ]);
      expect(copied.every(row => !before.selection.ids.has(row.id))).toBe(true);
      if (form === 'ad') expect(copied[0]).toHaveProperty('name', 'Name 2');
      const duplicated = draft.snapshot;
      draft.change({
        ...duplicated.item,
        slides: {...duplicated.item.slides, name: 'Renamed'},
      });
      draft.undo();
      expect(draft.snapshot).toBe(duplicated);
      draft.undo();
      expect(draft.snapshot).toBe(before);
      draft.redo();
      expect(draft.snapshot).toBe(duplicated);
    },
  );

  it('uses the caret for text and verse insertions and restores it on undo', () => {
    const draft = setup();
    draft.selectRows({type: 'gap', index: 2});
    expect(draft.pasteText('Song one\nSong two\n\nNext slide')).toBe(true);
    expect(
      draft.snapshot.item.slides.slides
        .slice(2, 4)
        .map(row => ('text' in row ? row.text : '')),
    ).toEqual(['Song one\nSong two', 'Next slide']);
    draft.undo();
    expect(draft.snapshot.selection.caret).toBe(2);
    const added = {id: slideId(8), text: 'Inserted'};
    expect(draft.insert([added])).toBe(true);
    expect(draft.snapshot.item.slides.slides[2]).toEqual(added);
  });

  it('moves disjoint rows as one set and deletes into an undoable caret', () => {
    const draft = setup();
    draft.selectRows({type: 'click', id: slideId(2)});
    draft.selectRows({type: 'click', id: slideId(4), ctrl: true});
    const before = draft.snapshot;
    draft.commandRows({type: 'move', index: 0});
    expect(draft.snapshot.item.slides.slides.map(row => row.id)).toEqual(
      [2, 4, 1, 3].map(slideId),
    );
    draft.undo();
    expect(draft.snapshot).toBe(before);
    draft.commandRows({type: 'delete'});
    expect(draft.snapshot.selection.caret).toBe(1);
    expect(draft.snapshot.item.slides.slides.map(row => row.id)).toEqual(
      [1, 3].map(slideId),
    );
    draft.undo();
    expect(draft.snapshot).toBe(before);
  });

  it('retains verse references and media, refuses invalid forms and over-cap pastes atomically', () => {
    const translation = parsePayload(translationIdSchema, 'krv');
    if (!translation.ok) throw new Error('Invalid translation');
    const verse: Slide = {
      id: slideId(8),
      verse: {translation: translation.value, book: 43, chapter: 3, verse: 16},
    };
    const picture: Slide = {
      id: slideId(9),
      media: createMediaId('20000000-0000-4000-8000-000000000001'),
    };
    const blank = setup();
    expect(blank.commandRows({type: 'paste', slides: [verse, picture]})).toBe(
      true,
    );
    const copies = blank.snapshot.item.slides.slides.slice(1, 3);
    expect(copies[0]).toMatchObject({verse: verse.verse});
    expect(copies[1]).toMatchObject({media: picture.media});
    expect(copies[0]?.id).not.toBe(verse.id);
    const ad = setup('ad');
    const before = ad.snapshot;
    expect(ad.commandRows({type: 'paste', slides: [verse]})).toBe(false);
    expect(
      ad.commandRows({
        type: 'paste',
        slides: Array.from({length: 200}, () => picture),
      }),
    ).toBe(false);
    expect(ad.snapshot).toBe(before);
    expect(
      slideRowsAdapter('blank').validate([
        {id: slideId(9), text: 'Invalid', name: 'Ad'},
      ]).ok,
    ).toBe(false);
    expect(blank.pasteText({text: 'Invalid'})).toBe(false);
  });
});
