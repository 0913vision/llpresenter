import {expect, it} from 'vitest';
import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import type {SongSlide} from '@core/schema/song';
import {SlideListClipboard, SlideListModel} from '@core/songs/slideListModel';
import {songSlideListAdapter} from '@core/songs/songSlideListAdapter';

it('maps present, past and future without changing selection or unrelated slides', () => {
  const first: SongSlide = {id: fixtureSlideId(1), lines: ['A']};
  const initialOther: SongSlide = {id: fixtureSlideId(2), lines: ['Other']};
  const model = new SlideListModel({
    slides: [first, initialOther],
    adapter: songSlideListAdapter(),
    clipboard: new SlideListClipboard<SongSlide>(),
  });
  const other = model.getSnapshot().slides[1];
  if (other === undefined) throw new Error('Missing second slide');
  model.select({type: 'click', id: other.id});
  const selection = model.getSnapshot().selection;
  const edit = (text: string): void => {
    const state = model.getSnapshot();
    expect(
      model.edit({...state, slides: [{...first, lines: [text]}, other]}).ok,
    ).toBe(true);
  };
  edit('B');
  edit('C');
  model.undo();
  model.mapSlides(slides =>
    slides.map(slide =>
      slide.id === first.id ? {...slide, label: 'Mapped'} : slide,
    ),
  );
  const check = (text: string): void => {
    const state = model.getSnapshot();
    expect(state.selection).toEqual(selection);
    expect(state.slides[0]).toMatchObject({lines: [text], label: 'Mapped'});
    expect(state.slides[1]).toBe(other);
  };
  check('B');
  model.undo();
  check('A');
  model.redo();
  check('B');
  model.redo();
  check('C');
});
