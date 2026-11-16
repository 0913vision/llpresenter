import {render} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {createScreenId, createThemeId} from '@core/schema/ids';
import {OutputPreviewPicture} from '@renderer/rendering/OutputPreviewPicture';

const renderOutput = vi.hoisted(() => vi.fn());
const disposeOutput = vi.hoisted(() => vi.fn());
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = renderOutput;
    dispose = disposeOutput;
    ready = () => true;
  },
}));
vi.mock('@renderer/rendering/previewMedia', () => ({
  openPreviewMedia: () => undefined,
}));

function props() {
  const screenId = createScreenId('00000000-0000-4000-8000-000000000001');
  return {
    layers: emptyLayers(),
    appearance: {
      screen: {
        id: screenId,
        kind: 'audience' as const,
        method: 'fullscreen' as const,
      },
      theme: {
        themeId: createThemeId('00000000-0000-4000-8000-000000000002'),
        revision: 1,
        missing: [],
        sourceScreenId: screenId,
        layout: {mode: {kind: 'own' as const}, elements: []},
        emptyColor: '#000000',
        item: null,
      },
      background: '#000000',
      checker: false,
    },
  };
}

it('reuses the composed preview when equivalent slide and theme props are recreated', () => {
  renderOutput.mockClear();
  const view = render(<OutputPreviewPicture {...props()} />);
  const initialCalls = renderOutput.mock.calls.length;
  expect(initialCalls).toBeGreaterThan(0);
  view.rerender(<OutputPreviewPicture {...props()} />);
  expect(renderOutput).toHaveBeenCalledTimes(initialCalls);
  const changed = props();
  view.rerender(
    <OutputPreviewPicture
      {...changed}
      layers={{
        ...changed.layers,
        slide: {itemId: 'one', position: 0, label: null, lines: ['changed']},
      }}
    />,
  );
  expect(renderOutput.mock.calls.length).toBeGreaterThan(initialCalls);
  view.unmount();
  expect(disposeOutput).toHaveBeenCalled();
});

it('reveals without a font set and ignores a frame after unmount', () => {
  let callback: FrameRequestCallback | undefined;
  const request = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation(fn => {
      callback = fn;
      return 1;
    });
  const cancel = vi
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(() => undefined);
  const fonts = Object.getOwnPropertyDescriptor(document, 'fonts');
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: undefined,
  });
  try {
    const view = render(<OutputPreviewPicture {...props()} />);
    expect(callback).toBeDefined();
    actFrame(callback);
    expect(
      view.container.querySelector('[data-preview-ready="true"]'),
    ).not.toBeNull();
    view.rerender(
      <OutputPreviewPicture
        {...props()}
        layers={{
          ...emptyLayers(),
          slide: {itemId: 'next', position: 0, label: null, lines: ['Next']},
        }}
      />,
    );
    const stale = callback;
    view.unmount();
    expect(cancel).toHaveBeenCalled();
    expect(() => actFrame(stale)).not.toThrow();
  } finally {
    if (fonts === undefined) Reflect.deleteProperty(document, 'fonts');
    else Object.defineProperty(document, 'fonts', fonts);
    request.mockRestore();
    cancel.mockRestore();
  }
});

function actFrame(callback: FrameRequestCallback | undefined): void {
  if (callback === undefined) throw new Error('No frame scheduled');
  callback(performance.now());
}
