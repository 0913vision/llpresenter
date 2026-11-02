import {renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {useThemePanels} from '@renderer/features/screens/themes/useThemePanels';
import {useScreensPanels} from '@renderer/app/workspaces/screensPanels';

vi.mock('@renderer/features/screens/themes/useThemePanels', () => ({
  useThemePanels: vi.fn(() => ({
    left: 'theme list',
    canvas: 'theme canvas',
    right: 'theme properties',
  })),
}));

describe('useScreensPanels', () => {
  it('lays out only the theme list, the canvas, and the properties, in three columns', () => {
    const onProblem = vi.fn();

    const {result} = renderHook(() =>
      useScreensPanels({active: true, onProblem}),
    );

    expect(useThemePanels).toHaveBeenCalledWith(true, onProblem, undefined);
    expect(result.current.columns).toEqual([
      ['테마'],
      ['테마 편집'],
      ['테마 속성'],
    ]);
    expect(result.current.partsOf('테마')).toEqual({embedded: 'theme list'});
    expect(result.current.partsOf('테마 편집')).toEqual({
      embedded: 'theme canvas',
    });
    expect(result.current.partsOf('테마 속성')).toEqual({
      embedded: 'theme properties',
    });
  });
});
