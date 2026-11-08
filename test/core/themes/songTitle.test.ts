import {expect, it} from 'vitest';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {songTitleLayout} from '@core/themes/songTitle';

it('replaces only lyrics with title text and optional subtitle on an opted-in layout', () => {
  const lyrics = {
    ...themeElementBase(),
    kind: 'currentText',
    text: {...themeElementBase().text, maxLines: 3},
  } as const;
  const background = {
    ...themeElementBase(),
    kind: 'background',
    fit: 'fit',
    radius: 0,
  } as const;
  const layout: ThemeScreenLayout = {
    mode: {kind: 'own'},
    songTitle: 'sunday',
    elements: [background, lyrics],
  };
  const slide = {
    itemId: 'song',
    position: 0,
    label: null,
    lines: ['Title', 'Subtitle'],
    titleSlide: true,
  } as const;
  const resolved = songTitleLayout(layout, slide);
  expect(resolved.elements[0]).toBe(background);
  expect(
    resolved.elements
      .slice(1)
      .map(element => (element.kind === 'text' ? element.content : '')),
  ).toEqual(['Title', 'Subtitle']);
  expect(
    songTitleLayout(layout, {...slide, lines: ['Title']}).elements.at(-1),
  ).toMatchObject({content: ''});
  const {titleSlide: titleFlag, ...lyric} = slide;
  expect(songTitleLayout(layout, lyric)).toBe(layout);
  expect(songTitleLayout(layout, null)).toBe(layout);
  const {songTitle: removed, ...ordinary} = layout;
  expect(songTitleLayout(ordinary, slide)).toBe(ordinary);
  const linked: ThemeScreenLayout = {...layout, mode: {kind: 'empty'}};
  expect(songTitleLayout(linked, slide)).toBe(linked);
});
