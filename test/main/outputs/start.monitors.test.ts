import {
  stage,
  savedDisplay,
  main,
  setup,
  loaded,
  mocks,
} from '@fixtures/main/outputs/startFixtures';
import {describe, expect, it, vi} from 'vitest';
import {outputEndpoints} from '@contracts/ipc/output';
import {parseMonitorList} from '@core/schema/monitors';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {displayInfo} from '@fixtures/main/displays/testing';
import {CAPTIONS, MAIN} from '@fixtures/core/overlays';
import {openNumberWindow} from '@main/outputs/numberWindow';
import {sendToWindows} from '@main/ipc';

describe('saved output backend', () => {
  it('releases the wake lock, its listeners, and its channels once when outputs stop', async () => {
    const {settings, store, stop} = setup();
    await loaded();
    store.dispatch({type: 'output.set', screenId: MAIN, on: true});

    stop();
    stop();

    expect(mocks.stop).toHaveBeenCalledExactlyOnceWith(7);
    expect(store.listenerCount).toBe(0);
    expect(settings.listeners.size).toBe(0);
    expect(mocks.displays?.watcherCount).toBe(0);
    expect(mocks.handlers.size + mocks.answers.size).toBe(0);
  });

  it('renders monitor identification in offscreen windows while running', async () => {
    const {store, stop} = setup();
    await loaded();
    const skipped = vi.fn();
    store.dispatch({type: 'monitors.identify'}, undefined, skipped);
    expect(skipped).not.toHaveBeenCalled();
    expect(vi.mocked(openNumberWindow)).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(openNumberWindow).mock.calls) {
      expect(call[2]).toBe('offscreen');
    }
    stop();
    store.dispatch({type: 'monitors.identify'}, undefined, skipped);
    expect(skipped).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'failed'}),
    );
  });

  it('opens a number window on each monitor for 모니터 확인 and closes them when outputs stop', async () => {
    const {store, stop} = setup(undefined, 'normal');
    await loaded();

    store.dispatch({type: 'monitors.identify'});
    const spots = vi.mocked(openNumberWindow).mock.calls.map(([spot]) => spot);
    expect(spots.map(({number}) => number)).toEqual([1, 2, 3]);
    expect(mocks.closeNumber).not.toHaveBeenCalled();
    stop();

    expect(mocks.closeNumber).toHaveBeenCalledTimes(3);
  });

  it('hides every 테스트 패턴 when the control window goes away, until outputs stop', async () => {
    const {store, stop, controlWindow} = setup();
    await loaded();
    const show = (): void => {
      const command = parseLiveCommand({
        type: 'screen.testPattern.set',
        screenId: MAIN,
        on: true,
      });
      if (!command.ok) throw new Error(JSON.stringify(command.error));
      store.dispatch(command.value);
    };
    show();
    expect(store.state.testPatterns).toEqual([MAIN]);
    controlWindow.emit('closed');
    expect(store.state).not.toHaveProperty('testPatterns');
    show();
    stop();
    controlWindow.emit('closed');
    expect(store.state.testPatterns).toEqual([MAIN]);
  });

  it('reads the monitors at once for 모니터 다시 찾기 and raises the output for 창 보기', async () => {
    const {store, windows} = setup();
    await loaded();
    store.dispatch({type: 'output.set', screenId: 'main', on: true});
    const output = windows.only(MAIN);
    const displays = mocks.displays;
    if (displays === null) throw new Error('Missing displays');
    displays.displays = [displayInfo({id: 1, primary: true}), stage];

    mocks.handlers.get(outputEndpoints.findMonitors.channel)?.(undefined, 1);
    mocks.handlers.get(outputEndpoints.showWindow.channel)?.(
      {screenId: 'main'},
      1,
    );

    expect(output.mode.kind).toBe('window');
    expect(output.raises).toBe(1);
  });

  it('routes capture aliases and frame statuses by UUID and forgets removed reports', async () => {
    const {save, store, running, windows} = setup();
    await loaded();
    save([{...main, id: CAPTIONS, method: 'window'}]);
    store.dispatch({type: 'output.set', screenId: 'captions', on: true});
    expect(store.state.outputs).toEqual({
      [CAPTIONS]: true,
      broadcast: true,
      captions: true,
    });
    mocks.handlers.get(outputEndpoints.frameRate.channel)?.(
      {screenId: CAPTIONS, fps: 60},
      1,
    );
    expect(running.frameRates()).toEqual([{screen: CAPTIONS, fps: 60}]);
    expect(mocks.answers.get(outputEndpoints.status.channel)?.()).toMatchObject(
      {
        broadcast: {fps: 60},
        captions: {fps: 60},
        [CAPTIONS]: {fps: 60},
      },
    );
    expect(windows.only(CAPTIONS).mode.kind).toBe('window');
    save([]);
    save([{...main, id: CAPTIONS, method: 'window'}]);
    expect(running.frameRates()).toEqual([]);
  });

  it('answers the monitor list and pushes it when the monitors change', async () => {
    const {stop} = setup();
    await loaded();
    const numbers = () => {
      const parsed = parseMonitorList(
        mocks.answers.get(outputEndpoints.monitors.channel)?.(),
      );
      if (!parsed.ok) throw new Error(parsed.error.message);
      return parsed.value.map(monitor => monitor.number);
    };
    expect(numbers()).toEqual([1, 2, 3]);

    const displays = mocks.displays;
    if (displays === null) throw new Error('Missing displays');
    displays.displays = [displayInfo({id: 1, primary: true}), stage];
    mocks.handlers.get(outputEndpoints.findMonitors.channel)?.(undefined, 1);

    expect(numbers()).toEqual([1, 2]);
    expect(vi.mocked(sendToWindows)).toHaveBeenCalledWith(
      outputEndpoints.monitorsChanged.channel,
      expect.arrayContaining([expect.objectContaining({number: 2})]),
      expect.anything(),
    );
    stop();
    expect(mocks.answers.has(outputEndpoints.monitors.channel)).toBe(false);
  });

  it('pushes the monitor list when only the assignment changes', async () => {
    const {save} = setup();
    await loaded();
    vi.mocked(sendToWindows).mockClear();

    save([{...main, display: savedDisplay(stage)}]);

    const pushes = vi
      .mocked(sendToWindows)
      .mock.calls.filter(
        ([channel]) => channel === outputEndpoints.monitorsChanged.channel,
      );
    const parsed = parseMonitorList(pushes.at(-1)?.[1]);
    if (!parsed.ok) throw new Error(parsed.error.message);
    expect(
      parsed.value.map(monitor => [monitor.number, monitor.screenIds]),
    ).toEqual([
      [1, []],
      [2, []],
      [3, [MAIN]],
    ]);
  });
});
