import {describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {LiveStore, dispatchLogged} from './store';

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
