import {act, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {createDefaultThemes} from '@core/themes/defaults';
import {editThemeLayout, findTheme} from '@core/themes/themeEdits';
import {
  THEME_HISTORY_LIMIT,
  useThemeDraft,
} from '@renderer/features/screens/themes/useThemeDraft';

const main = {
  id: createScreenId('00000000-0000-4000-8000-000000000001'),
  kind: 'audience',
} as const;

describe('the working copy history', () => {
  it('keeps only the latest edits to step back through', () => {
    const saved = createDefaultThemes();
    const theme = saved.themes[0];
    if (theme === undefined) throw new Error('Missing starter theme');
    const target = {theme: theme.id, screen: main, screens: [main]};
    const {result} = renderHook(() =>
      useThemeDraft({
        saved,
        reason: undefined,
        change: () => Promise.resolve({ok: true, value: true}),
        report: () => undefined,
      }),
    );
    const edits = THEME_HISTORY_LIMIT + 1;
    for (let step = 1; step <= edits; step++) {
      act(() =>
        result.current.edit(theme.id, file =>
          editThemeLayout(file, target, layout => ({
            ...layout,
            background: `#${String(step).padStart(6, '0')}`,
          })),
        ),
      );
    }
    for (let step = 0; step < edits; step++) act(() => result.current.undo());
    const shown = result.current.file;
    const layout =
      shown === null ? undefined : findTheme(shown, theme.id)?.screens[main.id];
    expect(layout?.background).toBe('#000001');
  });

  it('says when there is an edit to undo or redo', () => {
    const saved = createDefaultThemes();
    const theme = saved.themes[0];
    if (theme === undefined) throw new Error('Missing starter theme');
    const target = {theme: theme.id, screen: main, screens: [main]};
    const {result} = renderHook(() =>
      useThemeDraft({
        saved,
        reason: undefined,
        change: () => Promise.resolve({ok: true, value: true}),
        report: () => undefined,
      }),
    );
    expect([result.current.canUndo(), result.current.canRedo()]).toEqual([
      false,
      false,
    ]);
    act(() =>
      result.current.edit(theme.id, file =>
        editThemeLayout(file, target, layout => ({
          ...layout,
          background: '#000001',
        })),
      ),
    );
    expect([result.current.canUndo(), result.current.canRedo()]).toEqual([
      true,
      false,
    ]);
    act(() => result.current.undo());
    expect([result.current.canUndo(), result.current.canRedo()]).toEqual([
      false,
      true,
    ]);
  });
});

it('groups live drag edits once and ends the group before a later edit', () => {
  const saved = createDefaultThemes();
  const theme = saved.themes[0];
  if (theme === undefined) throw new Error('Missing starter theme');
  const target = {theme: theme.id, screen: main, screens: [main]};
  const {result} = renderHook(() =>
    useThemeDraft({
      saved,
      reason: undefined,
      change: () => Promise.resolve({ok: true, value: true}),
      report: () => undefined,
    }),
  );
  const original = theme.screens[main.id]?.background;
  const edit = (background: string) =>
    act(() =>
      result.current.edit(theme.id, file =>
        editThemeLayout(file, target, layout => ({...layout, background})),
      ),
    );
  const shown = () =>
    result.current.file === null
      ? undefined
      : findTheme(result.current.file, theme.id)?.screens[main.id]?.background;
  const finish = result.current.beginEditGroup();
  edit('#000001');
  edit('#000002');
  edit('#000003');
  expect(shown()).toBe('#000003');
  finish();
  edit('#000004');
  act(() => result.current.undo());
  expect(shown()).toBe('#000003');
  act(() => result.current.undo());
  expect(shown()).toBe(original);
  act(() => result.current.redo());
  expect(shown()).toBe('#000003');
});
