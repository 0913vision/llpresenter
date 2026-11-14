import {describe, expect, it} from 'vitest';
import {createScreenId, createThemeId} from '../schema/ids';
import {createDefaultThemes} from './defaults';
import {
  commitDraft,
  editDraft,
  saveDraftAs,
  withDraft,
  type ThemeDraft,
} from './themeDraft';
import {editThemeLayout, findTheme, replaceTheme} from './themeEdits';

const main = {
  id: createScreenId('00000000-0000-4000-8000-000000000001'),
  kind: 'audience',
} as const;
const copyId = createThemeId('00000000-0000-4000-8000-000000000901');

function setup() {
  const saved = createDefaultThemes();
  const theme = saved.themes[0];
  if (theme === undefined) throw new Error('Missing starter theme');
  const target = {theme: theme.id, screen: main, screens: [main]};
  const emptied = editDraft({saved, draft: null, themeId: theme.id}, shown =>
    editThemeLayout(shown, target, layout => ({...layout, elements: []})),
  );
  if (!emptied.ok || emptied.value === null) throw new Error('No draft');
  return {saved, theme, target, draft: emptied.value};
}

describe('theme draft', () => {
  it('shows the draft layouts in place of the saved ones and leaves the saved file alone', () => {
    const {saved, theme, draft} = setup();
    expect(
      findTheme(withDraft(saved, draft), theme.id)?.screens[main.id],
    ).toEqual(expect.objectContaining({elements: []}));
    expect(findTheme(saved, theme.id)?.screens[main.id]?.elements).not.toEqual(
      [],
    );
    expect(withDraft(saved, null)).toBe(saved);
  });

  it('stacks edits on the draft and drops it when an edit changes nothing', () => {
    const {saved, theme, draft} = setup();
    const unchanged = editDraft({saved, draft, themeId: theme.id}, shown => ({
      ok: true,
      value: shown,
    }));
    expect(unchanged).toEqual({ok: true, value: draft});
    const reverted = editDraft({saved, draft, themeId: theme.id}, () => ({
      ok: true,
      value: saved,
    }));
    expect(reverted).toEqual({ok: true, value: null});
  });

  it('keeps transition edits in a draft, commits them and copies them', () => {
    const {saved, theme} = setup();
    const transition = {kind: 'wipe' as const, sec: 0.7};
    const edited = editDraft(
      {saved, draft: null, themeId: theme.id},
      shown => ({ok: true, value: replaceTheme(shown, {...theme, transition})}),
    );
    if (!edited.ok || edited.value === null) throw new Error('No draft');
    expect(
      findTheme(withDraft(saved, edited.value), theme.id)?.transition,
    ).toEqual(transition);
    const committed = commitDraft(saved, edited.value);
    if (!committed.ok) throw new Error('No commit');
    expect(findTheme(committed.value, theme.id)?.transition).toEqual(
      transition,
    );
    const copied = saveDraftAs(saved, edited.value, {id: copyId, name: 'Copy'});
    if (!copied.ok) throw new Error('No copy');
    expect(findTheme(copied.value, copyId)?.transition).toEqual(transition);
  });

  it('refuses an edit that the theme rules reject and keeps the draft', () => {
    const {saved, theme, draft, target} = setup();
    const refused = editDraft({saved, draft, themeId: theme.id}, shown =>
      editThemeLayout(shown, target, () => ({mode: {kind: 'bogus'}})),
    );
    expect(refused).toEqual({ok: false, error: 'invalid'});
  });

  it('writes the draft layouts into the saved theme on commit', () => {
    const {saved, theme, draft} = setup();
    const committed = commitDraft(saved, draft);
    expect(committed.ok && findTheme(committed.value, theme.id)?.screens).toBe(
      draft.screens,
    );
  });

  it('refuses to commit into a theme that no longer exists', () => {
    const {saved, draft} = setup();
    const gone: ThemeDraft = {...draft, themeId: copyId};
    expect(commitDraft(saved, gone)).toEqual({ok: false, error: 'missing'});
  });

  it('adds a named copy from the draft and keeps the original as saved', () => {
    const {saved, theme, draft} = setup();
    const result = saveDraftAs(saved, draft, {id: copyId, name: '새 이름'});
    if (!result.ok) throw new Error(result.error);
    expect(findTheme(result.value, copyId)).toMatchObject({name: '새 이름'});
    expect(findTheme(result.value, copyId)?.screens).toBe(draft.screens);
    expect(findTheme(result.value, theme.id)).toBe(findTheme(saved, theme.id));
  });

  it('refuses a copy name that another theme has', () => {
    const {saved, theme, draft} = setup();
    const result = saveDraftAs(saved, draft, {id: copyId, name: theme.name});
    expect(result).toEqual({ok: false, error: 'taken'});
  });
});
