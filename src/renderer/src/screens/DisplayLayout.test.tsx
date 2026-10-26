import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import type {MonitorList} from '@shared/schema/monitors';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {DisplayLayout} from './DisplayLayout';
import {useScreensSelection} from './selection';
import {CAPTIONS_ID, MAIN_ID, screensDocument} from './testing/documents';

function monitor(number: number, x: number, hasMainWindow = false) {
  return {
    number,
    name: `Monitor ${number}`,
    bounds: {x, y: 0, width: 1920, height: 1080},
    scaleFactor: 1,
    refreshRate: 60,
    hasMainWindow,
    screenIds: number === 2 ? [MAIN_ID] : [],
  };
}

const monitors: MonitorList = [monitor(1, 0, true), monitor(2, 1920)];

function setup(
  get: () => Promise<MonitorList> = () => Promise.resolve(monitors),
) {
  let push: (next: MonitorList) => void = () => undefined;
  const stop = vi.fn();
  const send = vi.fn<(command: LiveCommand) => void>();
  const write = vi.fn();
  window.llp = fakeLlpApi({
    monitors: {
      get,
      subscribe: listener => {
        push = listener;
        return stop;
      },
    },
    settings: {get: () => Promise.resolve(screensDocument())},
    live: {send},
    log: {write},
  });
  const view = render(<DisplayLayout />);
  return {
    view,
    stop,
    send,
    write,
    push: (next: MonitorList) => act(() => push(next)),
  };
}

beforeEach(() => {
  useScreensSelection.setState({selection: {kind: 'screen', id: null}});
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

function entry(width: number, height: number): ResizeObserverEntry {
  return {
    target: document.body,
    contentRect: {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    },
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  };
}

function stubStage(width: number, height: number) {
  const observers: Array<() => void> = [];
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        observers.push(() => callback([entry(width, height)], this));
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnect;
    },
  );
  return {
    measure: () => act(() => observers.forEach(run => run())),
    disconnect,
  };
}

function box(number: number): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-monitor="${number}"]`,
  );
  if (element === null) throw new Error(`Missing monitor box ${number}`);
  return element;
}

describe('the display layout', () => {
  it('shows a box per monitor with its number, name, and resolution', async () => {
    setup();

    await waitFor(() => expect(box(2)).toBeTruthy());
    expect(box(1).textContent).toContain('컨트롤');
    expect(box(2).textContent).toContain('Monitor 2');
    expect(box(2).textContent).toContain('1920×1080');
  });

  it('shows the screen assigned to a monitor and the targets without one', async () => {
    setup();

    await waitFor(() => expect(box(2).textContent).toContain('본 화면'));
    expect(
      document.querySelector(`[data-target="${CAPTIONS_ID}"]`),
    ).not.toBeNull();
  });

  it('highlights the monitor of the selected screen', async () => {
    setup();
    await waitFor(() => expect(box(2).textContent).toContain('본 화면'));
    expect(box(2).getAttribute('aria-current')).toBe('true');
    expect(box(1).getAttribute('aria-current')).toBeNull();

    act(() => useScreensSelection.getState().select('screen', CAPTIONS_ID));

    expect(box(2).getAttribute('aria-current')).toBeNull();
    expect(
      document
        .querySelector(`[data-target="${CAPTIONS_ID}"]`)
        ?.getAttribute('aria-current'),
    ).toBe('true');
  });

  it('fits a tall arrangement in a short panel with one uniform scale', async () => {
    const stage = stubStage(400, 100);
    const stacked: MonitorList = [
      monitor(1, 0, true),
      {...monitor(2, 0), bounds: {x: 0, y: 1080, width: 1920, height: 1080}},
    ];
    setup(() => Promise.resolve(stacked));
    await waitFor(() => expect(box(2)).toBeTruthy());

    stage.measure();

    const arrangement = box(1).parentElement;
    const {width, height} = arrangement?.style ?? {};
    expect(parseFloat(width ?? '')).toBeCloseTo(100 * (1920 / 2160), 5);
    expect(parseFloat(height ?? '')).toBeCloseTo(100, 5);
  });

  it('stops observing the panel when it unmounts', async () => {
    const stage = stubStage(400, 400);
    const {view} = setup();
    await waitFor(() => expect(box(2)).toBeTruthy());

    view.unmount();

    expect(stage.disconnect).toHaveBeenCalled();
  });

  it('follows a pushed monitor list', async () => {
    const {push} = setup();
    await waitFor(() => expect(box(2)).toBeTruthy());

    push([monitor(1, 0, true)]);

    expect(document.querySelector('[data-monitor="2"]')).toBeNull();
  });

  it('sends 모니터 번호 표시 as a command', async () => {
    const {send} = setup();

    await userEvent.click(
      screen.getByRole('button', {name: '모니터 번호 표시'}),
    );

    expect(send).toHaveBeenCalledWith({type: 'monitors.identify'});
  });

  it('logs a failed read and keeps the layout empty', async () => {
    const {write} = setup(() => Promise.reject(new Error('no answer')));

    await waitFor(() => expect(write).toHaveBeenCalled());
    expect(write.mock.calls[0]?.[0]).toMatchObject({
      level: 'error',
      message: 'Could not read the monitors',
    });
    expect(document.querySelector('[data-monitor]')).toBeNull();
  });

  it('releases its subscription when it unmounts', () => {
    const {view, stop} = setup();

    view.unmount();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
