import {
  stage,
  savedDisplay,
  main,
  setup,
  loaded,
  mocks,
  STAGE_SCREEN,
} from '@fixtures/main/outputs/startFixtures';
import {describe, expect, it, vi} from 'vitest';
import {outputEndpoints} from '@contracts/ipc/output';
import {parseMonitorList} from '@core/schema/monitors';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {displayInfo} from '@fixtures/main/displays/testing';
import {intersectionArea} from '@main/displays/rect';
import {dispatchLogged} from '@main/live/store';
import {CAPTIONS, MAIN, STAGE} from '@fixtures/core/overlays';
import {openNumberWindow} from '@main/outputs/numberWindow';
import {sendToWindows} from '@main/ipc';

describe('saved output backend', () => {
  it('releases the last wake lock for removed or unsupported screens even without monitors', async () => {
    const {settings, store, windows, stop, log, save} = setup();
    await loaded();
    save([main, {...main, id: STAGE, method: 'window'}]);
    store.dispatch({
      type: 'live.batch',
      commands: [MAIN, STAGE].map(screenId => ({
        type: 'output.set',
        screenId,
        on: true,
      })),
    });
    save([{...main, id: STAGE, method: 'window'}]);
    expect(windows.only(MAIN).destroyed).toBe(true);
    expect(mocks.stop).not.toHaveBeenCalled();
    mocks.displays?.change();
    save([{...main, id: STAGE, method: 'ndi'}]);
    expect(windows.only(STAGE).destroyed).toBe(true);
    expect(Object.values(store.state.outputs).some(Boolean)).toBe(false);
    expect(mocks.stop).toHaveBeenCalledExactlyOnceWith(7);
    dispatchLogged(store, {type: 'output.set', screenId: STAGE, on: true}, log);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(log.entries.at(-1)).toMatchObject({
      level: 'warn',
      detail: {reason: 'missing-target'},
    });
    stop();
    stop();
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

  it('opens a number window on each monitor away from a shown capture window', async () => {
    const {store, save, windows, stop} = setup(undefined, 'normal');
    await loaded();
    save([
      {...main, method: 'capture', resolution: {width: 1280, height: 720}},
    ]);
    store.dispatch({type: 'output.set', screenId: MAIN, on: true});
    const capture = windows.only(MAIN).bounds();
    if (capture === null) throw new Error('Missing capture window');
    store.dispatch({type: 'monitors.identify'});
    const spots = vi.mocked(openNumberWindow).mock.calls.map(([spot]) => spot);
    expect(spots.map(({number}) => number)).toEqual([1, 2, 3]);
    for (const {bounds} of spots) {
      expect(intersectionArea(bounds, capture)).toBe(0);
    }
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

  it('reads the monitors at once for 모니터 다시 찾기 and raises the fallback for 창 보기', async () => {
    const {store, windows, log} = setup();
    await loaded();
    store.dispatch({type: 'output.set', screenId: 'main', on: true});
    const output = windows.only(MAIN);
    expect(output.mode.kind).toBe('fullscreen');
    const displays = mocks.displays;
    if (displays === null) throw new Error('Missing displays');
    displays.displays = [displayInfo({id: 1, primary: true}), stage];

    mocks.handlers.get(outputEndpoints.findMonitors.channel)?.(undefined, 1);
    expect(output.mode.kind).toBe('window');
    expect(mocks.answers.get(outputEndpoints.status.channel)?.()).toMatchObject(
      {
        main: {placement: 'monitorMissing', monitor: 2},
      },
    );

    mocks.handlers.get(outputEndpoints.showWindow.channel)?.(
      {screenId: 'main'},
      1,
    );
    expect(output.raises).toBe(1);
    mocks.handlers.get(outputEndpoints.showWindow.channel)?.({screenId: ''}, 1);
    expect(output.raises).toBe(1);
    expect(log.messages('warn')).toContain(
      'dropped a malformed show window request',
    );
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

  it('answers and pushes the new refresh rate when only that changes', async () => {
    setup();
    await loaded();
    const rates = () => {
      const parsed = parseMonitorList(
        mocks.answers.get(outputEndpoints.monitors.channel)?.(),
      );
      if (!parsed.ok) throw new Error(parsed.error.message);
      return parsed.value.map(monitor => monitor.refreshRate);
    };
    expect(rates()).toEqual([60, 60, 60]);

    const displays = mocks.displays;
    if (displays === null) throw new Error('Missing displays');
    displays.displays = [
      displayInfo({id: 1, primary: true}),
      displayInfo({id: 2, x: 1920, refreshRate: 75}),
      stage,
    ];
    mocks.handlers.get(outputEndpoints.findMonitors.channel)?.(undefined, 1);

    expect(rates()).toEqual([60, 75, 60]);
    expect(vi.mocked(sendToWindows)).toHaveBeenLastCalledWith(
      outputEndpoints.monitorsChanged.channel,
      expect.arrayContaining([expect.objectContaining({refreshRate: 75})]),
      expect.anything(),
    );
  });

  it('keeps configured monitor assignments through output toggles and publishes display changes', async () => {
    const twin = {name: 'Generic PnP'};
    const second = (id: number, x: number) =>
      displayInfo({id, x, name: twin.name});
    const stageScreen = {
      ...main,
      id: STAGE_SCREEN,
      name: 'Stage',
      kind: 'stage',
      display: savedDisplay(second(3, 3840)),
    };
    const displays = mocks.displays;
    if (displays === null) throw new Error('Missing displays');
    displays.displays = [
      displayInfo({id: 1, primary: true}),
      second(22, 1920),
      second(33, 3840),
    ];
    const {save, store, windows} = setup();
    await loaded();
    save([{...main, display: savedDisplay(second(2, 1920))}, stageScreen]);
    const assignment = () => {
      const parsed = parseMonitorList(
        mocks.answers.get(outputEndpoints.monitors.channel)?.(),
      );
      if (!parsed.ok) throw new Error(parsed.error.message);
      return parsed.value.map(monitor => [monitor.number, monitor.screenIds]);
    };
    expect(assignment()).toEqual([
      [1, []],
      [2, [MAIN]],
      [3, [STAGE_SCREEN]],
    ]);
    expect(store.state.outputs[MAIN]).not.toBe(true);
    store.dispatch({type: 'output.set', screenId: MAIN, on: true});
    store.dispatch({type: 'output.set', screenId: MAIN, on: false});
    expect(windows.only(MAIN).mode.kind).toBe('hidden');
    expect(assignment()).toEqual([
      [1, []],
      [2, [MAIN]],
      [3, [STAGE_SCREEN]],
    ]);

    displays.displays = [
      displayInfo({id: 1, primary: true}),
      second(33, 1920),
      second(22, 3840),
    ];
    mocks.handlers.get(outputEndpoints.findMonitors.channel)?.(undefined, 1);

    expect(assignment()).toEqual([
      [1, []],
      [2, [STAGE_SCREEN]],
      [3, [MAIN]],
    ]);
    expect(vi.mocked(sendToWindows)).toHaveBeenLastCalledWith(
      outputEndpoints.monitorsChanged.channel,
      expect.arrayContaining([
        expect.objectContaining({number: 3, screenIds: [MAIN]}),
      ]),
      expect.anything(),
    );
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
