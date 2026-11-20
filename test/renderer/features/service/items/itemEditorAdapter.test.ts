import {describe, expect, it, vi} from 'vitest';
import {isItemOfKind} from '@core/schema/service';
import {newLiturgyItem} from '@core/services/liturgy';
import {newSectionItem} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {ids, otherItems, templateOrder} from '@fixtures/core/serviceList';
import {slidesItem} from '@fixtures/core/slides';
import {
  adaptItemEditor,
  itemEditorAdapter,
} from '@renderer/platform/itemEditorAdapter';
import {SongSession} from '@renderer/features/songs/editor/songSession';
import {editorDeckSong} from '@fixtures/renderer/features/songs/editor/editorFixture';

describe('item editor capabilities', () => {
  const song = templateOrder.find(item => isItemOfKind(item, 'song'));
  const bible = templateOrder.find(item => isItemOfKind(item, 'bible'));
  const media = otherItems.find(item => isItemOfKind(item, 'media'));
  const section = SUNDAY_SECTIONS[0];
  if (!song || !bible || !isItemOfKind(bible, 'bible') || !media || !section) {
    throw Error('Missing editor fixtures');
  }
  const sermon = {
    id: ids.word,
    sermon: {title: 'Sermon', passage: bible.bible},
  };
  const liturgy = newLiturgyItem(ids.word, {
    kind: 'creed',
    translation: 'new',
  });
  it.each([
    ['song', song, true, false, false, true, false, false],
    ['blank', slidesItem('blank'), true, true, true, true, false, true],
    ['ad', slidesItem('ad'), true, true, false, true, false, true],
    ['bible', bible, false, false, false, true, true, false],
    ['sermon', sermon, false, false, false, false, false, false],
    ['liturgy', liturgy, false, false, false, false, false, false],
    ['media', media, false, false, false, false, false, false],
    [
      'title',
      newSectionItem(ids.word, section),
      true,
      true,
      true,
      true,
      false,
      true,
    ],
  ] as const)('%s exposes its supported commands', (...args) => {
    const [
      ,
      item,
      addSlide,
      addPicture,
      addVerse,
      addTitle,
      splitVerses,
      timedAdvance,
    ] = args;
    expect(itemEditorAdapter(item)).toMatchObject({
      addSlide,
      addPicture,
      addVerse,
      addTitle,
      splitVerses,
      timedAdvance,
    });
  });
});

describe('the shared item editor session', () => {
  it('exposes the existing ordered selection and history', () => {
    const kind = 'song' as const;
    const document = editorDeckSong(2);
    const session = new SongSession({
      document,
      api: {
        edit: async () => ({
          ok: true,
          value: {id: document.song.id, revision: 2},
        }),
      },
      persistence: 'manual',
      changed: vi.fn(),
      problem: vi.fn(),
    });
    const options = {
      kind,
      session,
      hasCard: true,
      cardSelected: true,
      blocked: false,
    };
    const adapter = adaptItemEditor({
      ...options,
      view: session.slideModel.getSnapshot(),
    });
    expect(adapter.itemId).toBe(document.song.id);
    expect(adapter.entries[0]?.identity).toEqual({
      kind: 'card',
      itemId: document.song.id,
    });
    const first = session.slideModel.getSnapshot().slides[0];
    if (first === undefined) throw Error('Missing slide');
    expect(adapter.entries[1]).toMatchObject({
      identity: {kind: 'slide', itemId: document.song.id, slideId: first.id},
      selected: true,
    });
    expect(adapter.selectedSlideIds.has(first.id)).toBe(true);
    expect(adapter.focusedIndex).toBe(1);
    expect(
      adapter.preview(
        {kind: 'slide', itemId: document.song.id, slideId: first.id},
        'stage',
      )?.role,
    ).toBe('stage');
    expect(
      adapter.preview({kind: 'card', itemId: 'another item'}, 'audience'),
    ).toBeNull();
    adapter.command({type: 'duplicate'});
    expect(
      adaptItemEditor({...options, view: session.slideModel.getSnapshot()})
        .canUndo,
    ).toBe(true);
    adapter.edit('undo');
    expect(session.slideModel.getSnapshot().slides).toHaveLength(
      document.song.slides.length,
    );
    expect(
      adaptItemEditor({
        ...options,
        blocked: true,
        view: session.slideModel.getSnapshot(),
      }).readOnly,
    ).toBe(true);
    session.discard();
  });
});
