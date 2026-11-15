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
  },
}));
vi.mock('@renderer/rendering/previewMedia', () => ({
  openPreviewMedia: () => undefined,
}));

it('reuses the composed preview when equivalent slide and theme props are recreated', () => {
  renderOutput.mockClear();
  const screenId = createScreenId('00000000-0000-4000-8000-000000000001');
  const props = () => ({
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
  });
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
