import {afterEach, describe, expect, it, vi} from 'vitest';
import {render} from '@testing-library/react';
import {createScreenId} from '@core/schema/ids';
import {builtInTheme} from '@core/themes/defaults';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import type {LiveLayers} from '@core/live/state';
import type {RenderFrame, RenderLayerOptions} from '@renderer/rendering/layer';

const drawing = vi.hoisted(() => ({
  render: vi.fn<(layers: LiveLayers, frame: RenderFrame) => void>(),
  dispose: vi.fn(),
  create: vi.fn<(options: RenderLayerOptions) => void>(),
}));
vi.mock('@renderer/rendering/themeComposition', () => ({
  ThemeCompositionView: class {
    constructor(_parent: HTMLElement, options: RenderLayerOptions) {
      drawing.create(options);
    }
    render = drawing.render;
    rescale = vi.fn();
    dispose = drawing.dispose;
  },
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe.each(['song', 'bible', 'blank', 'ad', 'media'] as const)(
  '%s slide pictures',
  kind => {
    it.each(['audience', 'stage', 'broadcast'] as const)(
      'uses the output composer on %s',
      role => {
        vi.stubGlobal(
          'ResizeObserver',
          class {
            observe() {}
            disconnect() {}
          },
        );
        const id = createScreenId('00000000-0000-4000-8000-000000000001');
        const screen = {
          id,
          kind: role,
          method:
            role === 'broadcast' ? ('ndi' as const) : ('fullscreen' as const),
        };
        const theme = builtInTheme(kind, [screen]);
        const layout = theme.screens[id];
        if (layout === undefined) throw new Error('Missing layout');
        const slide = {
          itemId: 'item',
          position: 0,
          label: null,
          lines: ['Example'],
        };
        const item = {id: 'item', kind, source: 'service' as const};
        const view = render(
          <SlidePicture
            exact
            slide={slide}
            layout={layout}
            item={item}
            screen={screen}
            themeId={theme.id}
          />,
        );
        expect(drawing.render.mock.lastCall?.[0]).toMatchObject({slide});
        expect(drawing.render.mock.lastCall?.[1]).toMatchObject({
          slide,
          screen,
          transitions: false,
          theme: {themeId: theme.id, layout, item},
        });
        expect(drawing.create.mock.lastCall?.[0].transparent).toBe(
          role === 'broadcast',
        );
        view.unmount();
        expect(drawing.dispose).toHaveBeenCalled();
      },
    );
  },
);
