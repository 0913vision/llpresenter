import {expect, it} from 'vitest';
import type {ThemeFile} from '@core/schema/screens/theme';
import type {Themes} from '@core/schema/screens/themes';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {builtIn, themes} from '@fixtures/core/themeOutput';
import {
  THEME_HISTORY_LIMIT,
  ThemeDraftHistory,
} from '@renderer/features/screens/themes/saving/themeDraftHistory';

function copy(name: string): ThemeFile {
  return {...builtIn(BUILT_IN_THEME_IDS.lyrics), name};
}

function list(count: number): Themes {
  return {...themes(), themes: themes().themes.slice(0, count)};
}

it('makes a group of edits, such as one drag, one step', () => {
  const history = new ThemeDraftHistory();
  const end = history.beginGroup();
  history.edited(null);
  history.edited(copy('a'));
  history.edited(copy('b'));
  end();
  history.edited(copy('c'));
  expect(history.next('undo')).toEqual({kind: 'draft', value: copy('c')});
  history.tookDraft('undo', copy('d'));
  expect(history.next('undo')).toEqual({kind: 'draft', value: null});
});

it('moves a taken draft step the other way with the copy it replaced', () => {
  const history = new ThemeDraftHistory();
  history.edited(null);
  history.tookDraft('undo', copy('a'));
  expect(history.can('undo')).toBe(false);
  expect(history.next('redo')).toEqual({kind: 'draft', value: copy('a')});
});

it('leaves nothing to redo after a new edit', () => {
  const history = new ThemeDraftHistory();
  history.edited(null);
  history.tookDraft('undo', copy('a'));
  history.edited(null);
  expect(history.can('redo')).toBe(false);
});

it('moves a written save step only while it is still next', () => {
  const history = new ThemeDraftHistory();
  history.saved(list(1), list(2));
  const step = history.next('undo');
  expect(step).toEqual({
    kind: 'saved',
    before: list(1),
    after: list(2),
  });
  if (step === undefined) return;
  history.edited(copy('a'));
  history.tookSaved('undo', step);
  expect(history.next('undo')).toEqual({kind: 'draft', value: copy('a')});
  expect(history.can('redo')).toBe(false);
});

it('takes no step while a save step is written', () => {
  const history = new ThemeDraftHistory();
  history.saved(list(1), list(2));
  history.setWriting(true);
  expect(history.can('undo')).toBe(false);
});

it(`keeps the latest ${THEME_HISTORY_LIMIT} steps and forgets them all on save`, () => {
  const history = new ThemeDraftHistory();
  for (let index = 0; index <= THEME_HISTORY_LIMIT; index += 1) {
    history.edited(copy(String(index)));
  }
  for (let index = 0; index < THEME_HISTORY_LIMIT; index += 1) {
    history.tookDraft('undo', null);
  }
  expect(history.can('undo')).toBe(false);
  history.forget();
  expect(history.can('redo')).toBe(false);
});
