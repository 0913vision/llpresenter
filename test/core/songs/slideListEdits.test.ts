import {describe, expect, it} from 'vitest';
import {
  copySlideList,
  editSlideList,
  slidesFromPlainText,
  validateSlideList,
  type SlideListAdapter,
} from '@core/songs/slideListEdits';
import {SLIDE_CLIPBOARD_LIMITS} from '@core/schema/slideClipboard';
import type {SongSlideId} from '@core/schema/ids';
import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {
  resultValue,
  selectedSlideList,
  slideListAdapter,
  slideListItem,
} from '@fixtures/core/songs/slideList';
import {
  emptySlideSelection,
  selectSlideList,
} from '@core/songs/slideListSelection';

describe('slide list commands', () => {
  it('changes only selected explicit transition durations and skips defaults and equal durations', () => {
    const {adapter, history} = selectedSlideList([1, 2, 3, 4], [1, 2, 3]);
    const slides = history.present.slides.map((slide, index) => {
      if (index === 0) {
        return {
          ...slide,
          transition: {kind: 'wipe' as const, dir: 'up' as const, sec: 1},
        };
      }
      if (index === 2) {
        return {
          ...slide,
          transition: {kind: 'push' as const, dir: 'right' as const, sec: 2},
        };
      }
      if (index === 3) {
        return {...slide, transition: {kind: 'dissolve' as const, sec: 1}};
      }
      return slide;
    });
    const before = {...history.present, slides};
    const next = resultValue(
      editSlideList(before, {type: 'transition-seconds', sec: 2}, adapter),
    );
    expect(next.slides[0]?.transition).toEqual({
      kind: 'wipe',
      dir: 'up',
      sec: 2,
    });
    expect(next.slides[1]).toEqual(slides[1]);
    expect(next.slides[2]).toEqual(slides[2]);
    expect(next.slides[3]).toEqual(slides[3]);
    expect(
      resultValue(
        editSlideList(next, {type: 'transition-seconds', sec: 2}, adapter),
      ),
    ).toBe(next);
    const empty = {...before, selection: emptySlideSelection<SongSlideId>()};
    expect(
      resultValue(
        editSlideList(empty, {type: 'transition-seconds', sec: 2}, adapter),
      ),
    ).toBe(empty);
  });

  it('copies a deep snapshot in list order, with labels and plain text', () => {
    const {adapter, history} = selectedSlideList([1, 2, 3, 4], [4, 2]);
    const copied = resultValue(copySlideList(history.present, adapter));
    expect(copied?.text).toBe('Line 2\n\nLine 4');
    expect(copied?.slides.map(slide => slide.label)).toEqual([
      'Verse',
      'Verse',
    ]);
    expect(copied?.slides[0]?.lines).not.toBe(history.present.slides[1]?.lines);
    expect(
      resultValue(
        copySlideList(
          {...history.present, selection: emptySlideSelection<SongSlideId>()},
          adapter,
        ),
      ),
    ).toBeNull();
  });

  it('duplicates a disjoint selection after the last selected slide with fresh IDs', () => {
    const {adapter, history} = selectedSlideList([1, 2, 3, 4, 5], [4, 2]);
    const next = resultValue(
      editSlideList(history.present, {type: 'duplicate'}, adapter),
    );
    expect(next.slides.map(slide => slide.id)).toEqual(
      [1, 2, 3, 4, 100, 101, 5].map(fixtureSlideId),
    );
    expect([...next.selection.ids]).toEqual([100, 101].map(fixtureSlideId));
    expect(history.present.slides).toHaveLength(5);
  });

  it.each([0, 2, 4])(
    'pastes at gap %s and strips keys even in an otherwise empty destination',
    index => {
      const {adapter, history} = selectedSlideList();
      const selection = selectSlideList<SongSlideId>(
        history.present.slides.map(slide => slide.id),
        history.present.selection,
        {type: 'gap', index},
      );
      const source = {
        ...slideListItem(9),
        hotKey: 'KeyA',
        extra: {keep: ['value']},
      };
      const next = resultValue(
        editSlideList(
          {...history.present, selection},
          {type: 'paste', slides: [source]},
          adapter,
        ),
      );
      expect(next.slides[index]).toEqual({
        ...slideListItem(9),
        id: fixtureSlideId(100),
        extra: {keep: ['value']},
      });
      expect(next.slides[index]).not.toBe(source);
      const empty = resultValue(
        editSlideList(
          {slides: [], selection: emptySlideSelection<SongSlideId>()},
          {type: 'paste', slides: [source]},
          adapter,
        ),
      );
      expect(empty.slides[0]?.hotKey).toBeUndefined();
      expect(source.hotKey).toBe('KeyA');
    },
  );

  it('appends a paste without selection or caret and deletes into a caret at the first removed slide', () => {
    const {adapter, history} = selectedSlideList();
    const appended = resultValue(
      editSlideList(
        {...history.present, selection: emptySlideSelection<SongSlideId>()},
        {type: 'paste', slides: [slideListItem(9)]},
        adapter,
      ),
    );
    expect(appended.slides.at(-1)?.lines).toEqual(['Line 9']);
    const next = resultValue(
      editSlideList(history.present, {type: 'delete'}, adapter),
    );
    expect(next.slides.map(slide => slide.id)).toEqual(
      [1, 3].map(fixtureSlideId),
    );
    expect(next.selection.caret).toBe(1);
  });

  it('deletes all slides for an item and refuses it for a nonempty library deck', () => {
    const {adapter, history} = selectedSlideList([1], [1]);
    expect(
      resultValue(editSlideList(history.present, {type: 'delete'}, adapter))
        .slides,
    ).toEqual([]);
    expect(
      editSlideList(
        history.present,
        {type: 'delete'},
        {...adapter, minSlides: 1},
      ),
    ).toEqual({ok: false, error: 'limit'});
  });

  it.each([0, 1, 3, 5])(
    'moves a set to original gap %s in list order without new IDs',
    index => {
      const {adapter, history} = selectedSlideList([1, 2, 3, 4, 5], [4, 2]);
      const next = resultValue(
        editSlideList(history.present, {type: 'move', index}, adapter),
      );
      const expected = [
        [2, 4, 1, 3, 5],
        [1, 2, 4, 3, 5],
        [1, 3, 2, 4, 5],
        [1, 3, 5, 2, 4],
      ][[0, 1, 3, 5].indexOf(index)];
      expect(next.slides.map(slide => slide.id)).toEqual(
        expected?.map(fixtureSlideId),
      );
      expect([...next.selection.ids]).toEqual([2, 4].map(fixtureSlideId));
    },
  );

  it('sets or removes one label for a set, trimming names and rejecting long names atomically', () => {
    const {adapter, history} = selectedSlideList();
    const next = resultValue(
      editSlideList(
        history.present,
        {type: 'label', label: '  Today  '},
        adapter,
      ),
    );
    expect(next.slides.map(slide => slide.label)).toEqual([
      'Verse',
      'Today',
      'Verse',
      'Today',
    ]);
    expect(
      resultValue(editSlideList(next, {type: 'label', label: ' '}, adapter))
        .slides[1],
    ).not.toHaveProperty('label');
    expect(
      editSlideList(next, {type: 'label', label: 'x'.repeat(65)}, adapter).ok,
    ).toBe(false);
  });

  it('does not make changes for empty commands, unchanged labels or unchanged moves', () => {
    const {adapter, history} = selectedSlideList([1, 2], [1]);
    for (const command of [
      {type: 'paste', slides: []},
      {type: 'move', index: 1},
      {type: 'label', label: 'Verse'},
    ] as const) {
      expect(
        resultValue(editSlideList(history.present, command, adapter)),
      ).toBe(history.present);
    }
    const empty = {
      ...history.present,
      selection: emptySlideSelection<SongSlideId>(),
    };
    for (const command of [
      {type: 'delete'},
      {type: 'duplicate'},
      {type: 'move', index: 2},
      {type: 'label', label: 'X'},
    ] as const) {
      expect(resultValue(editSlideList(empty, command, adapter))).toBe(empty);
    }
  });

  it('refuses invalid destinations, exhausted capacity, duplicate keys and reused identities', () => {
    const {adapter, history} = selectedSlideList();
    expect(
      editSlideList(history.present, {type: 'move', index: -1}, adapter).ok,
    ).toBe(false);
    expect(
      editSlideList(
        history.present,
        {type: 'duplicate'},
        {...adapter, maxSlides: 4},
      ),
    ).toEqual({ok: false, error: 'limit'});
    expect(
      editSlideList(
        history.present,
        {type: 'paste', slides: [slideListItem(9)]},
        {...adapter, newId: () => fixtureSlideId(9)},
      ).ok,
    ).toBe(false);
    expect(
      validateSlideList(
        [
          {...slideListItem(1), hotKey: 'KeyA'},
          {...slideListItem(2), hotKey: 'KeyA'},
        ],
        adapter,
      ).ok,
    ).toBe(false);
    expect(
      validateSlideList([slideListItem(1), slideListItem(1)], adapter).ok,
    ).toBe(false);
  });
});

describe('plain text and generic item adapters', () => {
  it('splits blank lines and normalizes newlines while preserving nonblank line spacing', () => {
    const adapter = slideListAdapter();
    const slides = resultValue(
      slidesFromPlainText(
        '\r\n  First\r\nSecond \r\n \t\r\n\r\nThird\rFourth\n',
        adapter,
      ),
    );
    expect(slides.map(slide => slide.lines)).toEqual([
      ['  First', 'Second '],
      ['Third', 'Fourth'],
    ]);
    expect(slides.every(slide => slide.label === undefined)).toBe(true);
    expect(resultValue(slidesFromPlainText(' \n\t', adapter))).toEqual([]);
    expect(slidesFromPlainText(4, adapter).ok).toBe(false);
    expect(
      slidesFromPlainText(
        'x'.repeat(SLIDE_CLIPBOARD_LIMITS.characters + 1),
        adapter,
      ).ok,
    ).toBe(false);
    expect(
      slidesFromPlainText('one\n\ntwo', {...adapter, maxSlides: 1}).ok,
    ).toBe(false);
  });

  it('supports text or media items without song lines and preserves their fields', () => {
    interface Item {
      readonly id: string;
      readonly text?: string;
      readonly media?: string;
    }
    let id = 0;
    const adapter: SlideListAdapter<Item> = {
      newId: () => `new-${id++}`,
      minSlides: 0,
      maxSlides: 200,
      fromLines: (lines, id) => ({id, text: lines.join('\n')}),
      toLines: item => item.text?.split('\n') ?? [],
      validate: slides => ({ok: true, value: slides}),
    };
    const parsed = resultValue(slidesFromPlainText('First\n\nSecond', adapter));
    expect(parsed.map(item => item.text)).toEqual(['First', 'Second']);
    const next = resultValue(
      editSlideList(
        {slides: [], selection: emptySlideSelection()},
        {type: 'paste', slides: [{id: 'media', media: 'media-id'}]},
        adapter,
      ),
    );
    expect(next.slides[0]).toEqual({id: 'new-2', media: 'media-id'});
  });
});
