import {describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {MAX_LIVE_BATCH_COMMANDS} from '@shared/schema/liveCommand';
import {LiveStore, dispatchBatched, dispatchLogged} from './store';

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
