import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';
import {openItem, useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('reveals only the focused order row on resize without selecting, outputting or stealing focus', () => {
  const callbacks = new Map<Element, () => void>();
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe = (target: Element) => callbacks.set(target, this.callback);
      disconnect = disconnect;
    },
  );
  const send = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  seedSampleService();
  openItem('song-morning');
  const {unmount} = render(
    <>
      <button>Outside</button>
      <div
        role="region"
        aria-label="Order viewport"
        style={{overflowY: 'auto'}}
      >
        <ServiceOrderList workspace="show" />
      </div>
    </>,
  );
  const viewport = screen.getByRole('region', {name: 'Order viewport'});
  const row = screen.getByRole('option', {name: /아침이 밝아 오네/});
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    value: 70,
  });
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 100, 200, 70),
  );
  const rowBounds = vi
    .spyOn(row, 'getBoundingClientRect')
    .mockImplementation(
      () => new DOMRect(0, 160 - viewport.scrollTop, 200, 30),
    );
  const resized = callbacks.get(viewport);
  if (!resized) throw new Error('Missing viewport observer');
  row.focus();
  const selected = useShow.getState().openItemId;
  const live = useLive.getState().state;
  act(resized);
  expect(viewport.scrollTop).toBe(20);
  expect(document.activeElement).toBe(row);
  act(resized);
  expect(viewport.scrollTop).toBe(20);
  viewport.scrollTop = 100;
  rowBounds.mockReturnValue(new DOMRect(0, 80, 200, 30));
  act(resized);
  expect(viewport.scrollTop).toBe(80);
  screen.getByRole('button', {name: 'Outside'}).focus();
  act(resized);
  expect(viewport.scrollTop).toBe(80);
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: 'Outside'}),
  );
  expect(useShow.getState().openItemId).toBe(selected);
  expect(useLive.getState().state).toBe(live);
  expect(send).not.toHaveBeenCalled();
  unmount();
  expect(disconnect).toHaveBeenCalled();
});
