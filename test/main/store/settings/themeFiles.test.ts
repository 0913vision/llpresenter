import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {createThemeId} from '@core/schema/common/ids';
import type {ThemeFile} from '@core/schema/screens/theme';
import type {Themes} from '@core/schema/screens/themes';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {
  arrangeThemes,
  DEFAULT_THEMES,
  readThemes,
  themeFolder,
  themeWrites,
} from '@main/store/settings/themeFiles';
import {builtIn} from '@fixtures/core/themeOutput';

const OWN = createThemeId('00000000-0000-4000-8000-000000000701');
let folder = '';

const own: ThemeFile = {
  ...builtIn(BUILT_IN_THEME_IDS.lyrics),
  id: OWN,
  name: '내 가사',
};
function withThemes(themes: readonly ThemeFile[]): Themes {
  return {
    ...DEFAULT_THEMES,
    themes,
  };
}
function renamed(id: ThemeFile['id'], name: string) {
  return BUILT_IN_THEMES.map(theme =>
    theme.id === id ? {...theme, name} : theme,
  );
}

function writes(before: Themes, after: Themes) {
  const result = themeWrites(before, after, folder);
  if (!result.ok) throw new Error(result.error.message);
  return {
    files: result.value.saves.map(save => save.target.file),
    texts: new Map(
      result.value.saves.map(save => [save.target.file, save.text]),
    ),
    removed: result.value.removals.map(target => target.file),
  };
}

function file(id: string) {
  return join(themeFolder(folder), `${id}.lltheme`);
}
function list() {
  return join(folder, 'themes.json');
}

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'llp-themes-'));
});
afterEach(() => rm(folder, {recursive: true, force: true}));

it('writes a file for a theme of the operator and none for the app’s own', () => {
  const {files, texts} = writes(
    DEFAULT_THEMES,
    withThemes([...BUILT_IN_THEMES, own]),
  );
  expect(files).toEqual([list(), file(OWN)]);
  expect(JSON.parse(texts.get(file(OWN)) ?? '')).toMatchObject({
    format: 'lltheme',
    name: '내 가사',
  });
});

it('writes a theme of the app once it is changed, and removes it when it is as before', () => {
  const changed = withThemes(renamed(BUILT_IN_THEME_IDS.lyrics, '바뀐 이름'));
  expect(writes(DEFAULT_THEMES, changed).files).toContain(
    file(BUILT_IN_THEME_IDS.lyrics),
  );
  const back = writes(changed, DEFAULT_THEMES);
  expect(back.files).toEqual([list()]);
  expect(back.removed).toEqual([file(BUILT_IN_THEME_IDS.lyrics)]);
});

it('leaves the files of the other themes alone', () => {
  const before = withThemes([...BUILT_IN_THEMES, own]);
  const after = withThemes([
    ...renamed(BUILT_IN_THEME_IDS.notice, '바뀐 광고'),
    own,
  ]);
  expect(writes(before, after).files).toEqual([
    list(),
    file(BUILT_IN_THEME_IDS.notice),
  ]);
});

it('removes the file of a deleted theme', () => {
  expect(
    writes(withThemes([...BUILT_IN_THEMES, own]), DEFAULT_THEMES).removed,
  ).toEqual([file(OWN)]);
});

it('reads what it wrote, and reports a file that is broken', async () => {
  const {texts} = writes(DEFAULT_THEMES, withThemes([...BUILT_IN_THEMES, own]));
  await mkdir(themeFolder(folder));
  await writeFile(file(OWN), texts.get(file(OWN)) ?? '');
  await writeFile(file('broken'), '{');
  const {themes, problems} = await readThemes(folder);
  expect(themes).toEqual([own]);
  expect(problems).toHaveLength(1);
});

it('reads nothing from a folder that is not there', async () => {
  expect(await readThemes(folder)).toEqual({themes: [], problems: []});
});

it('puts the themes in the order of the list, and new ones at the end', () => {
  const [first, second] = BUILT_IN_THEMES;
  if (first === undefined || second === undefined) {
    throw new Error('Missing themes');
  }
  const arranged = arrangeThemes(
    [own, {...first, name: '바뀐 이름'}],
    [OWN, second.id, first.id],
  );
  expect(arranged.slice(0, 3).map(theme => theme.name)).toEqual([
    '내 가사',
    second.name,
    '바뀐 이름',
  ]);
  expect(arranged).toHaveLength(BUILT_IN_THEMES.length + 1);
});
