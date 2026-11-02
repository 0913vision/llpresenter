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
});
