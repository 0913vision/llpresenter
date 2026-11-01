import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import {DEFAULT_LYRIC_STYLE} from '@core/themes/lyricStyle';
import {createThemeId} from '@core/schema/ids';
import type {ThemeElement} from '@core/schema/themes';
import {fixedThemeText, THEME_MAIN} from '@fixtures/core/themeOutput';
import type {RenderFrame, ThemeFrame} from '@renderer/rendering/layer';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {classes} from '@renderer/rendering/classes';

const song: LiveLayers = {
  ...emptyLayers(),
  slide: {
    itemId: 'invented',
    position: 0,
    label: 'Verse',
    lines: ['Invented line'],
    reference: 'Invented 1:1',
    next: {lines: ['Invented next'], label: 'Chorus'},
  },
};
const themeId = createThemeId('00000000-0000-4000-8000-000000000501');

function frame(
  elements: readonly ThemeElement[],
  changes: Partial<ThemeFrame> = {},
): RenderFrame {
  return {
    screen: {id: THEME_MAIN, kind: 'audience'},
    theme: {
      themeId,
      revision: 1,
      missing: [],
      sourceScreenId: THEME_MAIN,
      emptyColor: '#123456',
      layout: {mode: {kind: 'own'}, elements},
      item: {
        id: 'invented',
        kind: 'song',
        source: 'service',
        title: 'Item name',
        memo: 'Stage memo',
      },
      ...changes,
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('theme composition drawing', () => {
  it('keeps global layers above the theme in the specified order and preserves the legacy renderer', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    const root = document.createElement('div');
    const renderer = new OutputRenderer(root, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl: id => id,
      onError: vi.fn(),
    });
    const z = (kind: string) =>
      root.querySelector<HTMLElement>(`[data-layer="${kind}"]`)?.style.zIndex;
    renderer.render(song, frame([fixedThemeText()]));
    expect(z('theme')).toBe('1');
    expect(z('notice')).toBe('2');
    expect(z('prop')).toBe('3');
    expect(z('message')).toBe('4');
    expect(
      root
        .querySelector('[data-layer="lyrics"]')
        ?.classList.contains(classes.hidden),
    ).toBe(true);
    renderer.render(song, {});
    expect(
      root
        .querySelector('[data-layer="lyrics"]')
        ?.classList.contains(classes.hidden),
    ).toBe(false);
    expect(root.querySelector('[data-layer="lyrics"]')?.textContent).toContain(
      'Invented line',
    );
    renderer.dispose();
  });
});
