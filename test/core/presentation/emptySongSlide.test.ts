import {describe, expect, it} from 'vitest';
import {emptySongSlideText} from '@core/presentation/emptySongSlide';
import type {SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';

const slide: SlideLayer = {
  itemId: 'song',
  position: 0,
  label: 'Interlude',
  lines: [' ', ''],
};
const item: LiveThemeItem = {
  id: 'song',
  kind: 'song',
  source: 'service',
  title: 'Song title',
};

describe('emptySongSlideText', () => {
  it('prefers the label on stage and the title on broadcast', () => {
    expect(emptySongSlideText(slide, item, 'label')).toBe('Interlude');
    expect(emptySongSlideText(slide, item, 'title')).toBe('Song title');
  });
  it('falls back from the stage label to the title but never from title to label', () => {
    expect(emptySongSlideText({...slide, label: '  '}, item, 'label')).toBe(
      'Song title',
    );
    expect(
      emptySongSlideText(slide, {...item, title: '  '}, 'title'),
    ).toBeUndefined();
    expect(emptySongSlideText(slide, {...item, title: ''}, 'label')).toBe(
      'Interlude',
    );
    expect(
      emptySongSlideText(
        {...slide, label: null, title: 'Slide title'},
        {...item, title: ''},
        'title',
      ),
    ).toBe('Slide title');
    expect(
      emptySongSlideText(
        {...slide, label: null},
        {...item, title: ''},
        'label',
      ),
    ).toBeUndefined();
  });
  it('does not replace actual lyrics, cleared items, other kinds, or absent slides', () => {
    expect(
      emptySongSlideText({...slide, lines: ['lyrics']}, item, 'label'),
    ).toBeUndefined();
    expect(
      emptySongSlideText(slide, {...item, contentCleared: true}, 'label'),
    ).toBeUndefined();
    expect(
      emptySongSlideText(slide, {...item, kind: 'ad'}, 'title'),
    ).toBeUndefined();
    expect(emptySongSlideText(null, item, 'label')).toBeUndefined();
  });
});
