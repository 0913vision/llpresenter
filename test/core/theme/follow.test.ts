import {expect, it} from 'vitest';
import type {ThemeElement, ThemeFile} from '@core/schema/theme';
import {BUILT_IN_THEMES, followedText, SONG_THEME_IDS} from '@core/theme';

function screensOf(id: string): {
  readonly stage: readonly ThemeElement[];
  readonly audience: readonly ThemeElement[];
} {
  const theme: ThemeFile | undefined = BUILT_IN_THEMES.find(
    entry => entry.id === id,
  );
  const {stage, audience} = theme?.screens ?? {};
  if (stage?.mode !== 'own' || audience?.mode !== 'own') {
    throw new Error(`no own screens in ${id}`);
  }
  return {stage: stage.elements, audience: audience.elements};
}

function followed(id: string, content: string): readonly string[] | undefined {
  const {stage, audience} = screensOf(id);
  const element = stage.find(
    entry => entry.kind === 'text' && entry.content[0] === content,
  );
  if (element?.kind !== 'text') throw new Error(`no ${content} in ${id}`);
  const text = followedText(element, stage, audience);
  return text?.content;
}

it('follows the 청중 text that leads with the same value', () => {
  expect(followed(SONG_THEME_IDS.dark.hymnTitle, '{제목}\n{(찬송가)}')).toEqual(
    ['{제목}'],
  );
  expect(followed(SONG_THEME_IDS.dark.lyrics, '{가사}')).toEqual(['{가사}']);
  expect(followed(SONG_THEME_IDS.dark.title, '{제목}')).toEqual(['{제목}']);
});

it('sizes a label like the text it labels', () => {
  expect(followed(SONG_THEME_IDS.dark.hymnTitle, '{(새 이름표)}')).toEqual([
    '{제목}',
  ]);
  expect(followed(SONG_THEME_IDS.dark.lyrics, '({새 이름표})')).toEqual([
    '{가사}',
  ]);
});

it('follows nothing when no 청중 text leads with that value', () => {
  const {stage, audience} = screensOf(SONG_THEME_IDS.dark.hymnTitle);
  const title = stage.find(
    entry => entry.kind === 'text' && entry.content[0]?.startsWith('{제목}'),
  );
  if (title?.kind !== 'text') throw new Error('no hymn title');
  expect(
    followedText({...title, content: ['{구절}']}, stage, audience),
  ).toBeUndefined();
});
