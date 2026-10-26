import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {LIVE_STATE_LIMITS} from '@shared/schema/liveLimits';
import {parseMacroId} from '@shared/schema/ids';
import {expectSuccess} from '@shared/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {MAX_LIVE_BATCH_COMMANDS} from '@shared/schema/liveCommand';
import {defineSlice} from './slice';
import {SliceRegistry} from './sliceRegistry';
import {batchSlice} from './slices/batch';
import {LiveStore, dispatchBatched, dispatchLogged} from './store';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const overflowingOutputs = Object.fromEntries(
  Array.from({length: LIVE_STATE_LIMITS.outputs + 1}, (_, i) => [
    uuid(i),
    true,
  ]),
);

/** Runs a fixture 매크로 that notes itself and overflows the outputs. */
const overflowingMacroSlice = defineSlice({
  commands: ['macro.run'],
  initial: {},
  reduce: (history, {macroId}, {ranMacro}) => {
    ranMacro({macroId, name: `Invented ${macroId}`});
    return {
      ...history,
      state: {...history.state, outputs: overflowingOutputs},
    };
  },
});

const failingMacroSlice = defineSlice({
  commands: ['clear.undo'],
  initial: {},
  reduce: (_history, _command, {ranMacro}) => {
    ranMacro({macroId: expectSuccess(parseMacroId(uuid(500))), name: 'Skip'});
    throw new Error('Fixture failure');
  },
});

function macroRun(index: number) {
  return {
    type: 'macro.run',
    macroId: expectSuccess(parseMacroId(uuid(index))),
  } as const;
}

describe('LiveStore', () => {
  it('notifies listeners only when the state changes', () => {
    const store = new LiveStore();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.dispatch({type: 'layer.clear', target: 'all'})).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(
      store.dispatch({type: 'output.set', screenId: 'main', on: true}),
    ).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(store.state);
  });

  it('stops notifying and forgets a listener after unsubscribe', () => {
    const store = new LiveStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.listenerCount).toBe(1);
    unsubscribe();
    expect(store.listenerCount).toBe(0);
    store.dispatch({type: 'output.set', screenId: 'main', on: true});
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps a failing listener from affecting others or the state', () => {
    const store = new LiveStore();
    const errors: unknown[] = [];
    const after = vi.fn();
    store.subscribe(() => {
      throw new Error('render failed');
    });
    store.subscribe(after);
    const changed = store.dispatch(
      {type: 'output.set', screenId: 'main', on: true},
      error => errors.push(error),
    );
    expect(changed).toBe(true);
    expect(after).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
    expect(store.state.outputs['main']).toBe(true);
  });
});

describe('dispatchLogged', () => {
  it('applies the command and logs a listener that throws', () => {
    const store = new LiveStore();
    const log = recordingLogger();
    store.subscribe(() => {
      throw new Error('listener broke');
    });

    dispatchLogged(
      store,
      {type: 'output.set', screenId: 'main', on: true},
      log,
    );

    expect(store.state.outputs).toEqual({main: true});
    expect(log.messages('error')).toEqual(['live state listener failed']);
  });
});

describe('dispatchBatched', () => {
  it('applies commands in order in transactions of at most the batch limit', () => {
    const store = new LiveStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const dispatch = vi.spyOn(store, 'dispatch');
    const commands = Array.from(
      {length: MAX_LIVE_BATCH_COMMANDS + 1},
      (_, index) =>
        ({type: 'output.set', screenId: 'main', on: index % 2 === 0}) as const,
    );
    expect(dispatchBatched(store, commands, recordingLogger())).toBe(true);
    expect(dispatch.mock.calls.map(([command]) => command)).toEqual([
      {type: 'live.batch', commands: commands.slice(0, -1)},
      {type: 'live.batch', commands: commands.slice(-1)},
    ]);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.state.outputs['main']).toBe(true);
  });

  it('reports no change for no commands or commands that change nothing', () => {
    const store = new LiveStore();
    const dispatch = vi.spyOn(store, 'dispatch');
    expect(dispatchBatched(store, [], recordingLogger())).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(
      dispatchBatched(
        store,
        [{type: 'layer.clear', target: 'all'}],
        recordingLogger(),
      ),
    ).toBe(false);
  });
});

describe('dropped dispatch problems', () => {
  const store = () =>
    new LiveStore(
      undefined,
      () => 0,
      new SliceRegistry([batchSlice, overflowingMacroSlice, failingMacroSlice]),
    );

  it('reports each 매크로 that ran, after the drop is logged, and not a skipped one', () => {
    const live = store();
    const log = recordingLogger();
    const received: string[] = [];
    live.subscribeProblems(problem => {
      received.push(problem.name);
      expect(log.messages('warn')).toEqual(['dropped live dispatch']);
    });
    dispatchLogged(
      live,
      {
        type: 'live.batch',
        commands: [macroRun(1), {type: 'clear.undo'}, macroRun(2)],
      },
      log,
    );
    expect(received).toEqual([`Invented ${uuid(1)}`, `Invented ${uuid(2)}`]);
    expect(log.messages('error')).toEqual(['live command failed']);
    expect(log.entries.at(-1)).toMatchObject({
      message: 'dropped live dispatch',
      detail: {macroIds: [uuid(1), uuid(2)]},
    });
  });

  it('keeps a failing problem listener from the others and the state', () => {
    const live = store();
    const before = live.state;
    const errors: unknown[] = [];
    const after = vi.fn();
    live.subscribeProblems(() => {
      throw new Error('Card failed');
    });
    const stop = live.subscribeProblems(after);
    live.dispatch(macroRun(1), error => errors.push(error));
    expect(after).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(1);
    expect(live.state).toBe(before);
    stop();
    live.dispatch(macroRun(1));
    expect(after).toHaveBeenCalledOnce();
  });

  it('reports nothing for a dropped dispatch without a 매크로', () => {
    const live = new LiveStore(
      {...emptyLiveState(), outputs: overflowingOutputs},
      () => 0,
    );
    const problems = vi.fn();
    live.subscribeProblems(problems);
    live.dispatch({type: 'output.set', screenId: 'main', on: true});
    expect(problems).not.toHaveBeenCalled();
  });
});
