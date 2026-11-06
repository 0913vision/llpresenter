import {render} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {SplitSlidePicture} from '@renderer/features/bible/SplitSlidePicture';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import type {LiveLayers} from '@core/live/state';
import type {RenderFrame} from '@renderer/rendering/layer';

const drawing = vi.hoisted(() => ({
  render: vi.fn<(layers: LiveLayers, frame: RenderFrame) => void>(),
  dispose: vi.fn(),
  options: vi.fn(),
}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    constructor(_parent: HTMLElement, options: unknown) {
      drawing.options(options);
    }
    render = drawing.render;
    dispose = drawing.dispose;
  },
}));

describe('split slide picture', () => {
  it('draws the audience composition and measured continuation through the shared renderer and disposes it', () => {
    const element = {...themeElementBase(), kind: 'currentText' as const};
    const appearance = {
      ...previewAppearance({
        role: 'audience',
        themes: undefined,
        screens: undefined,
        item: {id: 'split', kind: 'bible', source: 'external'},
      }),
      background: 'split-background',
    };
    const props = {
      element,
      appearance,
      maxLines: 3,
      lines: ['Body', ' (계속)'],
      continued: true,
      reference: '요한복음 3:16',
    };
    const view = render(<SplitSlidePicture {...props} />);
    expect(drawing.render.mock.lastCall?.[0].media).toEqual({
      mediaId: 'split-background',
      startedAt: 0,
      loop: true,
    });
    expect(drawing.options).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'preview',
        biblePreview: {elementId: element.id, maxLines: 3},
      }),
    );
    expect(drawing.render.mock.lastCall?.[0].slide).toMatchObject({
      lines: props.lines,
      continued: true,
      reference: props.reference,
    });
    expect(drawing.render.mock.lastCall?.[1]).toEqual({
      theme: appearance.theme,
      screen: appearance.screen,
      transitions: false,
    });
    view.rerender(
      <SplitSlidePicture {...props} lines={['Final']} continued={false} />,
    );
    expect(drawing.render.mock.lastCall?.[0].slide).toMatchObject({
      lines: ['Final'],
      continued: false,
    });
    view.unmount();
    expect(drawing.dispose).toHaveBeenCalledOnce();
  });
});
