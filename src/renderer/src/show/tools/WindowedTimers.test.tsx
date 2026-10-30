import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseTimers} from '@core/schema/timers';
import {stageFixture} from './stageTesting';
import {WindowedTimers} from './WindowedTimers';

afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('bounds 500 rows, reaches the last timer by keyboard and releases its observer', () => {
  stageFixture();
  const api = window.llp;
  if (!api) throw new Error('Missing fixture');
  const read = vi.fn();
  const disconnect = vi.fn();
  let resized: () => void = () => undefined;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe = read;
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 320, 82),
  );
  const parsed = parseTimers(
    JSON.stringify({
      format: 'llsettings.timers',
      schemaVersion: 1,
      timers: Array.from({length: 500}, (_, n) => ({
        id: `00000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`,
        name: `Timer ${n}`,
        kind: 'countdown',
        duration: 30,
      })),
    }),
    'timers.json',
  );
  if (!parsed.ok) throw new Error('Invalid fixture');
  const {unmount} = render(
    <WindowedTimers api={api} timers={parsed.value.data.timers} />,
  );
  const list = screen.getByRole('list');
  Object.defineProperty(list, 'clientHeight', {value: 164});
  act(resized);
  expect(screen.getAllByRole('listitem').length).toBeLessThanOrEqual(6);
  list.focus();
  fireEvent.keyDown(list, {key: 'End'});
  const last = screen.getByRole('group', {name: 'Timer 499'});
  expect(within(last).getByRole('button', {name: '시작'})).toBe(
    document.activeElement,
  );
  expect(screen.getAllByRole('listitem').length).toBeLessThanOrEqual(6);
  fireEvent.keyDown(document.activeElement ?? list, {key: 'Home'});
  expect(
    screen
      .getByRole('group', {name: 'Timer 0'})
      .contains(document.activeElement),
  ).toBe(true);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
