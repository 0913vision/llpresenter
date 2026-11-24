import {expect, it} from 'vitest';
import {defaultSlideTransitions} from '@core/schema/app/preferences';
import type {ServiceItemOf} from '@core/schema/services/service';
import {withText} from '@core/slides/edits';
import {
  SERMON_TITLE_BOX,
  sermonItem,
  withOneSermonTitle,
} from '@core/slides/items';
import {slideOf} from '@fixtures/core/slides';
import {templateOrder} from '@fixtures/core/serviceList';

const making = {themes: null, transitions: defaultSlideTransitions};
const psalm = templateOrder.find(
  (item): item is ServiceItemOf<'bible'> => item.kind === 'bible',
);

it('starts the last title of a sermon with the next one hidden on 무대', () => {
  if (psalm === undefined) throw new Error('No passage');
  const item = sermonItem(making, {
    title: '빛의 길',
    passage: psalm.passage,
    slides: [slideOf(1, 'scripture')],
  });
  expect(item.slides.map(slide => slide.hideNext === true)).toEqual([
    false,
    false,
    true,
  ]);
});

it('changes both titles of a sermon when one of them is edited', () => {
  if (psalm === undefined) throw new Error('No passage');
  const item = sermonItem(making, {
    title: '빛의 길',
    passage: psalm.passage,
    slides: [slideOf(1, 'scripture')],
  });
  const [first] = item.slides;
  if (first === undefined) throw new Error('No title');
  const edited = item.slides.map(slide =>
    slide.id === first.id
      ? withText(slide, SERMON_TITLE_BOX, '빛의\n길')
      : slide,
  );
  const titles = withOneSermonTitle(item.slides, edited).map(
    slide => slide.texts[SERMON_TITLE_BOX],
  );
  expect(titles).toEqual(['빛의\n길', undefined, '빛의\n길']);
  expect(withOneSermonTitle(item.slides, item.slides)).toBe(item.slides);
});
