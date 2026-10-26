import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import type {MonitorList} from '@shared/schema/monitors';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {DisplayLayout} from './DisplayLayout';
import {ScreenList} from './ScreenList';
import {SCREEN_DRAG_MIME} from './screenDrag';
import {useScreensSelection} from './selection';
import {
  CAPTIONS_ID,
  MAIN_ID,
  STAGE_ID,
  screensDocument,
  settingsDocument,
} from './testing/documents';
import {wideMonitorArrangement} from './testing/monitorArrangement';

function monitor(number: number, x: number, hasMainWindow = false) {
  return {
    id: number,
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
  access: 'editable' | 'readOnly' = 'editable',
  document: SettingsDocument = screensDocument(),
) {
  let push: (next: MonitorList) => void = () => undefined;
  const stop = vi.fn();
  const send = vi.fn<(command: LiveCommand) => void>();
  const write = vi.fn();
  const edit = vi
    .fn()
    .mockResolvedValue({ok: true, value: {id: 'screens', revision: 2}});
  window.llp = fakeLlpApi({
    monitors: {
      get,
      subscribe: listener => {
        push = listener;
        return stop;
      },
    },
    settings: {
      get: () => Promise.resolve({...document, access}),
      edit,
    },
    live: {send},
    log: {write},
  });
  const view = render(<DisplayLayout />);
  return {
    view,
    stop,
    send,
    write,
    edit,
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
  it.each(['readOnly', 'olderPublisher'])(
    'rejects drops for %s',
    async state => {
      const older = monitors.map(monitor => ({
        number: monitor.number,
        name: monitor.name,
        bounds: monitor.bounds,
        scaleFactor: monitor.scaleFactor,
        refreshRate: monitor.refreshRate,
        hasMainWindow: monitor.hasMainWindow,
        screenIds: monitor.screenIds,
      }));
      const {edit} = setup(
        () => Promise.resolve(state === 'olderPublisher' ? older : monitors),
        state === 'readOnly' ? 'readOnly' : 'editable',
      );
      await waitFor(() => expect(box(2)).toBeTruthy());
      const dataTransfer = {types: [SCREEN_DRAG_MIME], getData: () => STAGE_ID};
      expect(fireEvent.dragOver(box(2), {dataTransfer})).toBe(true);
      fireEvent.drop(box(2), {dataTransfer});
      expect(edit).not.toHaveBeenCalled();
      if (state === 'readOnly') {
        render(<ScreenList />);
        const row = await screen.findByRole('option', {name: '무대 화면'});
        const source = row.closest('[draggable]');
        if (source === null) throw new Error('Missing screen row');
        expect(source).toHaveProperty('draggable', false);
        expect(fireEvent.dragStart(source, {dataTransfer})).toBe(false);
      }
    },
  );

  it('drags a screen row onto a monitor and clears the previous screen once', async () => {
    const {edit} = setup();
    render(<ScreenList />);
    const row = await screen.findByRole('option', {name: '무대 화면'});
    const source = row.closest('[draggable]');
    if (source === null) throw new Error('Missing drag source');
    await waitFor(() => expect(box(2)).toBeTruthy());
    const data = new Map<string, string>();
    const transfer = {
      get types() {
        return [...data.keys()];
      },
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
      setDragImage: vi.fn(),
    };
    fireEvent.dragStart(source, {dataTransfer: transfer});
    expect(data.get(SCREEN_DRAG_MIME)).toBe(STAGE_ID);
    expect(transfer.setDragImage).toHaveBeenCalled();
    expect(fireEvent.dragOver(box(1), {dataTransfer: transfer})).toBe(true);
    fireEvent.drop(box(1), {dataTransfer: transfer});
    expect(edit).not.toHaveBeenCalled();
    expect(fireEvent.dragOver(box(2), {dataTransfer: transfer})).toBe(false);
    fireEvent.drop(box(2), {dataTransfer: transfer});
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    const change: unknown = edit.mock.calls[0]?.[0];
    expect(change).toMatchObject({
      name: 'screens',
      baseRevision: 1,
      value: {
        screens: [
          {id: MAIN_ID},
          {id: CAPTIONS_ID},
          {id: STAGE_ID, display: {id: 2}, method: 'fullscreen'},
        ],
      },
    });
    expect(JSON.stringify(change)).not.toContain('Projector');
    expect(useScreensSelection.getState().selection).toEqual({
      kind: 'screen',
      id: STAGE_ID,
    });
  });

  it('keeps screen selection when releasing a native row drag', async () => {
    setup();
    render(<ScreenList />);
    const row = await screen.findByRole('option', {name: '무대 화면'});
    const previous = useScreensSelection.getState().selection;
    fireEvent.dragStart(row, {
      dataTransfer: {setData: vi.fn(), setDragImage: vi.fn()},
    });
    fireEvent.dragEnd(row);
    fireEvent.click(row, {detail: 1});
    expect(useScreensSelection.getState().selection).toBe(previous);
    fireEvent.pointerDown(row);
    fireEvent.click(row, {detail: 1});
    expect(useScreensSelection.getState().selection.id).toBe(STAGE_ID);
  });

  it('ignores unrelated drags and unknown screen ids', async () => {
    const {edit} = setup();
    await waitFor(() => expect(box(2)).toBeTruthy());
    for (const types of [['text/plain'], [SCREEN_DRAG_MIME]]) {
      fireEvent.drop(box(2), {dataTransfer: {types, getData: () => 'unknown'}});
    }
    expect(edit).not.toHaveBeenCalled();
  });

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
    const {width, aspectRatio, minWidth} = arrangement?.style ?? {};
    expect(parseFloat(width ?? '')).toBeCloseTo(100 * (1920 / 2160), 5);
    expect(parseFloat(aspectRatio ?? '')).toBeCloseTo(1920 / 2160);
    expect(minWidth).toContain('var(--size-row)');
  });

  it.each(['editable', 'readOnly'] as const)(
    'selects the exact wide layout and separate cards without writing (%s)',
    async access => {
      const stage = stubStage(800, 350);
      const source = screensDocument();
      if (source.name !== 'screens') throw new Error('Wrong document');
      const doc = settingsDocument('screens', {
        screens: source.value.screens.map(screen =>
          screen.id === STAGE_ID ? {...screen, method: 'window'} : screen,
        ),
      });
      const {edit, send} = setup(
        () => Promise.resolve(wideMonitorArrangement),
        access,
        doc,
      );
      await screen.findByRole('button', {name: '모니터 2 Second monitor'});
      stage.measure();
      const arrangement = box(1).parentElement;
      expect(parseFloat(arrangement?.style.width ?? '')).toBeCloseTo(800);
      expect(parseFloat(arrangement?.style.aspectRatio ?? '')).toBeCloseTo(
        5360 / 1440,
      );
      expect(parseFloat(box(2).style.top)).toBeCloseTo((222 / 1440) * 100);
      expect(parseFloat(box(2).style.left)).toBeCloseTo(
        parseFloat(box(1).style.width),
      );
      await userEvent.click(screen.getByRole('button', {name: '방송 자막'}));
      expect(useScreensSelection.getState().selection.id).toBe(CAPTIONS_ID);
      await userEvent.click(screen.getByRole('button', {name: '무대 화면'}));
      expect(useScreensSelection.getState().selection.id).toBe(STAGE_ID);
      expect(
        screen.getByRole('button', {name: '무대 화면'}).textContent,
      ).toContain('960×540');
      await userEvent.click(
        screen.getByRole('button', {name: '모니터 2 Second monitor'}),
      );
      expect(useScreensSelection.getState().selection.id).toBe(MAIN_ID);
      await userEvent.click(
        screen.getByRole('button', {name: '모니터 1 Wide monitor'}),
      );
      expect(box(1).getAttribute('aria-pressed')).toBe('true');
      expect(box(2).getAttribute('aria-pressed')).toBe('false');
      await userEvent.click(screen.getByRole('button', {name: '무대 화면'}));
      await userEvent.click(
        screen.getByRole('button', {name: '모니터 1 Wide monitor'}),
      );
      expect(
        screen
          .getByRole('button', {name: '무대 화면'})
          .getAttribute('aria-pressed'),
      ).toBe('false');
      expect(box(1).getAttribute('aria-pressed')).toBe('true');
      expect(edit).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('names the empty monitor and screen states', async () => {
    setup(
      () => Promise.resolve([]),
      'editable',
      settingsDocument('screens', {screens: []}),
    );
    expect(await screen.findByText('연결된 모니터 없음')).toBeDefined();
    expect(await screen.findByText('등록된 화면 없음')).toBeDefined();
    expect(document.querySelector('[data-monitor]')).toBeNull();
  });

  it('follows changed ownership after selecting a monitor box', async () => {
    const {push} = setup();
    const assigned = await screen.findByRole('button', {
      name: '모니터 2 Monitor 2',
    });
    await userEvent.click(assigned);
    push([
      {...monitor(1, 0, true), screenIds: [MAIN_ID]},
      {...monitor(2, 1920), screenIds: []},
    ]);
    expect(box(1).getAttribute('aria-pressed')).toBe('true');
    expect(box(2).getAttribute('aria-pressed')).toBe('false');
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
