import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {appEndpoints} from '@contracts/ipc/app';
import {
  APP_PROBLEM_LIMITS,
  macroDroppedProblem,
  type AppProblem,
} from '@core/schema/appProblem';
import {parseMacroId} from '@core/schema/ids';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';
import {expectSuccess} from '@core/schema/testHelpers';
import {recordingLogger} from './displays/testing';
import {defineSlice} from './live/slice';
import {SliceRegistry} from './live/sliceRegistry';
import {LiveStore} from './live/store';
import {MAX_UNREAD_PROBLEMS, registerProblemFeed} from './problemFeed';

const electron = vi.hoisted(() => ({
  handlers: new Map<string, () => unknown>(),
  send: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send: electron.send},
      },
    ],
  },
  ipcMain: {
    handle: (channel: string, handler: () => unknown) => {
      electron.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      electron.handlers.delete(channel);
    },
  },
}));

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const macroId = (index: number) => expectSuccess(parseMacroId(uuid(index)));

const overflowingMacroSlice = defineSlice({
  commands: ['macro.run'],
  initial: {},
  reduce: (history, {macroId: id}, {ranMacro}) => {
    ranMacro({macroId: id, name: 'Invented startup'});
    return {
      ...history,
      state: {
        ...history.state,
        outputs: Object.fromEntries(
          Array.from({length: LIVE_STATE_LIMITS.outputs + 1}, (_, i) => [
            uuid(i),
            true,
          ]),
        ),
      },
    };
  },
});

function list(): unknown {
  return electron.handlers.get(appEndpoints.problemList.channel)?.();
}

function setup() {
  const store = new LiveStore(
    undefined,
    () => 0,
    new SliceRegistry([overflowingMacroSlice]),
  );
  const log = recordingLogger();
  const registered = registerProblemFeed({store, log});
  onTestFinished(registered.dispose);
  return {store, log, ...registered};
}

beforeEach(() => {
  electron.handlers.clear();
  electron.send.mockClear();
});

describe('problem feed', () => {
  it('keeps a startup 매크로 drop for the window that lists after it, once', () => {
    const {store} = setup();
    store.dispatch({type: 'macro.run', macroId: macroId(7)});
    const dropped = macroDroppedProblem(macroId(7), 'Invented startup');
    expect(electron.send).toHaveBeenCalledExactlyOnceWith(
      appEndpoints.problems.channel,
      dropped,
    );
    expect(list()).toEqual([dropped]);
    expect(list()).toEqual([]);
  });

  it('lists the standing problems before the unread ones, and skips a failing source', () => {
    const {feed, log} = setup();
    const waiting = macroDroppedProblem(macroId(2), 'Invented standing');
    const removeSaves = feed.addStanding(() => [waiting]);
    feed.addStanding(() => {
      throw new Error('Invented source failure');
    });
    const dropped = macroDroppedProblem(macroId(1), 'Invented');
    feed.report(dropped);
    feed.push(waiting);
    expect(list()).toEqual([waiting, dropped]);
    expect(log.messages('error')).toEqual(['could not list standing problems']);
    removeSaves();
    expect(list()).toEqual([]);
    expect(electron.send.mock.calls).toEqual([
      [appEndpoints.problems.channel, dropped],
      [appEndpoints.problems.channel, waiting],
    ]);
  });

  it('always fits the unread problems beside a full standing list', () => {
    const {feed} = setup();
    const standing = Array.from({length: APP_PROBLEM_LIMITS.listed}, (_, i) =>
      macroDroppedProblem(macroId(100 + i), `Standing ${i}`),
    );
    feed.addStanding(() => standing);
    const dropped = [1, 2].map(i =>
      macroDroppedProblem(macroId(i), `Startup ${i}`),
    );
    for (const problem of dropped) feed.report(problem);
    expect(list()).toEqual([
      ...standing.slice(0, APP_PROBLEM_LIMITS.listed - 2),
      ...dropped,
    ]);
    expect(list()).toEqual(standing);
  });

  it('keeps only the newest unread problems', () => {
    const {feed} = setup();
    const reported: AppProblem[] = Array.from(
      {length: MAX_UNREAD_PROBLEMS + 2},
      (_, index) => macroDroppedProblem(macroId(index), `Macro ${index}`),
    );
    for (const problem of reported) feed.report(problem);
    expect(list()).toEqual(reported.slice(2));
  });

  it('stops reporting the live store and removes the list on dispose', () => {
    const {store, dispose} = setup();
    dispose();
    store.dispatch({type: 'macro.run', macroId: macroId(7)});
    expect(electron.send).not.toHaveBeenCalled();
    expect(electron.handlers.has(appEndpoints.problemList.channel)).toBe(false);
  });
});
