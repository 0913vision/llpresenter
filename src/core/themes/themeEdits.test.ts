import {describe, expect, it} from 'vitest';
import {createThemeId, createScreenId} from '../schema/ids';
import {createDefaultThemes} from './defaults';
import {
  editThemeLayout,
  editThemeList,
  type ThemeEditResult,
} from './themeEdits';

const id = createThemeId('00000000-0000-4000-8000-000000000900');
const main = {
  id: createScreenId('00000000-0000-4000-8000-000000000001'),
  kind: 'audience',
} as const;
const stage = {
  id: createScreenId('00000000-0000-4000-8000-000000000003'),
  kind: 'stage',
} as const;
const screens = [main, stage];
function value(result: ThemeEditResult) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
function setup() {
  const file = createDefaultThemes();
  const theme = file.themes[0];
  if (theme === undefined) throw new Error('Missing starter theme');
  return {file, theme, target: {theme: theme.id, screen: main, screens}};
}

describe('theme lifecycle edits', () => {
  it('starts configured screens in own mode and preserves the copy suffix within the name limit', () => {
    const {file, theme} = setup();
    const added = value(
      editThemeList(file, {kind: 'add', id, screens}, new Set()),
    );
    expect(added.themes.at(-1)?.screens[main.id]).toEqual({
      mode: {kind: 'own'},
      elements: [],
    });
    const renamed = value(
      editThemeList(
        file,
        {kind: 'rename', id: theme.id, name: 'a'.repeat(80)},
        new Set(),
      ),
    );
    const copied = value(
      editThemeList(
        renamed,
        {kind: 'duplicate', id, source: theme.id},
        new Set(),
      ),
    );
    expect(copied.themes.at(-1)?.name).toHaveLength(80);
    expect(copied.themes.at(-1)?.name.endsWith(' 복사본')).toBe(true);
  });
  it('adds a blank theme, duplicates retained layouts, and gives copies unique bounded names', () => {
    const {file, theme} = setup();
    const added = value(editThemeList(file, {kind: 'add', id}, new Set()));
    expect(added.themes.at(-1)).toEqual({id, name: '새 테마', screens: {}});
    const copied = value(
      editThemeList(file, {kind: 'duplicate', id, source: theme.id}, new Set()),
    );
    expect(copied.themes.at(-1)).toMatchObject({
      id,
      name: `${theme.name} 복사본`,
      screens: theme.screens,
    });
    expect(editThemeList(copied, {kind: 'add', id}, new Set())).toEqual({
      ok: false,
      error: 'duplicate-id',
    });
    const full = {...file, themes: Array.from({length: 200}, () => theme)};
    expect(editThemeList(full, {kind: 'add', id}, new Set())).toEqual({
      ok: false,
      error: 'full',
    });
  });

  it('trims names and refuses blank, long or taken names without changing unknown fields', () => {
    const {file, theme} = setup();
    const imported = {...file, future: 1};
    const renamed = value(
      editThemeList(
        imported,
        {kind: 'rename', id: theme.id, name: ' 새 이름 '},
        new Set(),
      ),
    );
    expect(renamed).toMatchObject({future: 1});
    expect(renamed.themes[0]?.name).toBe('새 이름');
    for (const name of ['', ' '.repeat(2), 'a'.repeat(81)]) {
      expect(
        editThemeList(file, {kind: 'rename', id: theme.id, name}, new Set()),
      ).toEqual({ok: false, error: 'name'});
    }
    expect(
      editThemeList(
        file,
        {kind: 'rename', id: theme.id, name: file.standby.name},
        new Set(),
      ),
    ).toEqual({ok: false, error: 'taken'});
  });

  it('confirms defaults and item references before deleting, preserving other defaults and standby', () => {
    const {file, theme} = setup();
    const assigned = value(
      editThemeList(
        file,
        {kind: 'default', id: theme.id, itemKind: 'media'},
        new Set(),
      ),
    );
    expect(assigned.defaults.media).toBe(theme.id);
    const released = value(
      editThemeList(
        assigned,
        {kind: 'default', id: theme.id, itemKind: 'media'},
        new Set(),
      ),
    );
    expect(released.defaults).not.toHaveProperty('media');
    expect(
      editThemeList(assigned, {kind: 'delete', id: theme.id}, new Set()),
    ).toEqual({ok: false, error: 'confirmation-required'});
    const removed = value(
      editThemeList(
        assigned,
        {kind: 'delete', id: theme.id, confirmed: true},
        new Set(),
      ),
    );
    expect(removed.themes.some(value => value.id === theme.id)).toBe(false);
    expect(removed.defaults).not.toHaveProperty('song');
    expect(removed.defaults.bible).toBe(file.defaults.bible);
    const added = value(editThemeList(file, {kind: 'add', id}, new Set()));
    expect(editThemeList(added, {kind: 'delete', id}, new Set([id]))).toEqual({
      ok: false,
      error: 'confirmation-required',
    });
    expect(
      editThemeList(
        file,
        {kind: 'delete', id: file.standby.id, confirmed: true},
        new Set(),
      ),
    ).toEqual({ok: false, error: 'standby'});
    expect(
      editThemeList(
        file,
        {kind: 'default', id: file.standby.id, itemKind: 'song'},
        new Set(),
      ),
    ).toEqual({ok: false, error: 'standby'});
  });
});

describe('screen layout edits', () => {
  it('retains own elements through empty and linked modes and refuses circular or missing links', () => {
    const {file, theme, target} = setup();
    const empty = value(
      editThemeLayout(file, target, layout => ({
        ...layout,
        mode: {kind: 'empty'},
      })),
    );
    expect(empty.themes[0]?.screens[main.id]?.elements).toEqual(
      theme.screens[main.id]?.elements,
    );
    const linked = value(
      editThemeLayout(
        empty,
        {theme: theme.id, screen: stage, screens},
        layout => ({...layout, mode: {kind: 'same', screen: main.id}}),
      ),
    );
    const cycle = editThemeLayout(linked, target, layout => ({
      ...layout,
      mode: {kind: 'same', screen: stage.id},
    }));
    expect(cycle).toEqual({ok: false, error: 'link'});
    expect(
      editThemeLayout(file, target, layout => ({
        ...layout,
        mode: {kind: 'same', screen: main.id},
      })),
    ).toEqual({ok: false, error: 'link'});
  });
});
