import {render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {editorPreviewFixture} from '@fixtures/renderer/features/songs/editor/editorPreviewFixture';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import {OutputSlidePicture} from '@renderer/rendering/OutputSlidePicture';

const mock = vi.hoisted(() => ({render: vi.fn(), dispose: vi.fn()}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = mock.render;
    dispose = mock.dispose;
  },
}));
vi.mock('@renderer/rendering/previewMedia', () => ({
  openPreviewMedia: () => undefined,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it('renders thumbnails at output resolution, scales the result and reuses unchanged compositions', () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
  const {themes, screens} = editorPreviewFixture();
  const appearance = previewAppearance({
    role: 'audience',
    themes: themes.value,
    screens: screens.value,
  });
  const slide = {itemId: 'item', position: 0, label: null, lines: ['Example']};
  const props = {
    slide,
    layout: appearance.theme.layout,
    emptyColor: appearance.theme.emptyColor,
    item: appearance.theme.item,
    screen: {
      id: createScreenId('00000000-0000-4000-8000-000000000001'),
      kind: 'audience' as const,
      method: 'fullscreen' as const,
    },
    thumbnail: true,
  };
  const view = render(<OutputSlidePicture {...props} />);
  const native = view.container.querySelector<HTMLElement>('[style*="1920px"]');
  expect(native?.style.width).toBe('1920px');
  expect(native?.style.height).toBe('1080px');
  expect(native?.style.transform).toBe(`scale(${320 / 1920})`);
  const calls = mock.render.mock.calls.length;
  view.rerender(<OutputSlidePicture {...props} slide={{...slide}} />);
  expect(mock.render).toHaveBeenCalledTimes(calls);
  view.rerender(
    <OutputSlidePicture {...props} slide={{...slide, lines: ['Changed']}} />,
  );
  expect(mock.render.mock.calls.length).toBeGreaterThan(calls);
  view.unmount();
  expect(mock.dispose).toHaveBeenCalledOnce();
});
