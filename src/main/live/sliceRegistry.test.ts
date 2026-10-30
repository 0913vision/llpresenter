import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {recordingLogger} from '../displays/testing';
import {initialHistory, liveSlices, type LiveHistory} from './reducer';
import {defineSlice} from './slice';
import {registryOf, SliceRegistry} from './sliceRegistry';
import {batchSlice} from './slices/batch';
import {dispatchLogged, LiveStore} from './store';

const fixtureSlice = defineSlice({
  commands: ['clear.undo'],
  initial: {},
  reduce: history => history,
});

describe('SliceRegistry', () => {
  it('returns a classified validation skip without throwing or changing the history', () => {
    const error = {field: 'items', message: 'Too many items'};
    const registry = new SliceRegistry([
      defineSlice({
        commands: ['clear.undo'],
        initial: {},
        reduce: (_history, _command, {reject}) => reject(error),
      }),
    ]);
    const history = initialHistory(emptyLiveState());
    expect(registry.run(history, {type: 'clear.undo'}, {now: 42})).toEqual({
      history,
      skipped: [{type: 'clear.undo', reason: 'invalid-overlay', error}],
    });
    expect(registry.apply(history, {type: 'clear.undo'}, 42)).toBe(history);
  });

  it('returns a failed command diagnostic and keeps the pure apply error observable', () => {
    const error = new Error('missing target');
    const registry = new SliceRegistry([
      defineSlice({
        commands: ['clear.undo'],
        initial: {},
        reduce: () => {
          throw error;
        },
      }),
    ]);
    const history = initialHistory(emptyLiveState());
    expect(registry.run(history, {type: 'clear.undo'}, {now: 42})).toEqual({
      history,
      skipped: [{type: 'clear.undo', reason: 'failed', error}],
    });
    expect(() => registry.apply(history, {type: 'clear.undo'}, 42)).toThrow(
      'live reducer failed',
    );
  });

  it('drops the effects a skipped child deferred and runs its siblings effects', () => {
    const ran: string[] = [];
    const registry = new SliceRegistry([
      batchSlice,
      defineSlice({
        commands: ['output.set'],
        initial: {},
        reduce: (history, _command, {defer}) => {
          defer(() => ran.push('applied'));
          return history;
        },
      }),
      defineSlice({
        commands: ['clear.undo'],
        initial: {},
        reduce: (_history, _command, {defer}) => {
          defer(() => ran.push('failed'));
          throw new Error('Fixture failure');
        },
      }),
      defineSlice({
        commands: ['layer.clear'],
        initial: {},
        reduce: (_history, _command, {defer, reject}) => {
          defer(() => ran.push('rejected'));
          return reject({field: 'target', message: 'Fixture rejection'});
        },
      }),
    ]);
    const result = registry.run(
      initialHistory(emptyLiveState()),
      {
        type: 'live.batch',
        commands: [
          {type: 'output.set', screenId: 'main', on: true},
          {type: 'clear.undo'},
          {type: 'layer.clear', target: 'all'},
        ],
      },
      {now: 42},
    );
    expect(ran).toEqual(['applied']);
    expect(result.skipped.map(problem => problem.reason)).toEqual([
      'failed',
      'invalid-overlay',
    ]);
  });

  it('collects slices while ignoring helper exports and matches command names exactly', () => {
    const registry = registryOf({
      './module.ts': {fixtureSlice, helper: () => 0},
    });
    expect(registry.handles('clear.undo')).toBe(true);
    expect(registry.handles('clear.undone')).toBe(false);
    expect(registry.handles('toString')).toBe(false);
  });

  it('rejects duplicate command ownership', () => {
    expect(() => new SliceRegistry([fixtureSlice, fixtureSlice])).toThrow(
      'two live slices handle clear.undo',
    );
  });

  it.each([null, {}, {helper: 'not a slice'}])(
    'rejects a module with no slice: %j',
    module => {
      expect(() => registryOf({'./empty.ts': module})).toThrow(
        './empty.ts exports no live slice',
      );
    },
  );

  it('merges initial layer fields without erasing other slices or base defaults', () => {
    const registry = new SliceRegistry([
      defineSlice({
        commands: ['slide.show'],
        initial: {
          layers: {
            slide: {itemId: 'initial', position: 0, label: null, lines: []},
          },
        },
        reduce: history => history,
      }),
      defineSlice({
        commands: ['message.show'],
        initial: {layers: {message: {messageId: 'initial', text: 'fixture'}}},
        reduce: history => history,
      }),
    ]);
    const initial = registry.initialState();
    expect(initial.layers.slide?.itemId).toBe('initial');
    expect(initial.layers.message?.text).toBe('fixture');
    expect(initial.layers.media).toBeNull();
    expect(initial.outputs).toEqual({});
    expect(initial.version).toBe(0);
  });

  it('leaves an unhandled command and history untouched', () => {
    const registry = new SliceRegistry([]);
    const history = initialHistory(emptyLiveState());
    expect(registry.apply(history, {type: 'clear.undo'}, 42)).toBe(history);
    expect(registry.initialState()).toEqual(emptyLiveState());
  });

  it('never calls a slice reducer for another command type', () => {
    const reduce = vi.fn((history: LiveHistory) => history);
    const slice = defineSlice({commands: ['clear.undo'], initial: {}, reduce});
    const history = initialHistory(emptyLiveState());
    expect(
      slice.apply(
        history,
        {type: 'output.set', screenId: 'main', on: true},
        {
          now: 42,
          apply: current => current,
          defer: () => undefined,
          ranMacro: () => undefined,
          reject: () => history,
        },
      ),
    ).toBe(history);
    expect(reduce).not.toHaveBeenCalled();
  });

  it('keeps fixture modules out of the production registry', () => {
    expect(liveSlices.initialState().outputs['fixture-loaded']).toBeUndefined();
  });

  it('keeps a newly added layer default when it is discovered before the content slice', () => {
    const defaults = defineSlice({
      commands: [],
      initial: {layers: {audio: {mediaId: 'fixture-default'}}},
      reduce: history => history,
    });
    const registry = registryOf({
      './new-defaults.ts': {defaults},
      ...import.meta.glob<unknown>(['./slices/*.ts', '!./slices/*.test.ts'], {
        eager: true,
      }),
    });
    expect(registry.initialState().layers.audio).toEqual({
      mediaId: 'fixture-default',
    });
  });
});

describe('unhandled live commands', () => {
  // NOTE(0913vision): Reflect supplies a runtime command outside today's shared
  // union, as a newly widened contract can before its slice is implemented.
  it.each(['fixture.future', 'toString', '__proto__'])(
    'rejects %s without changing state, version, undo, or notifying listeners',
    type => {
      const now = vi.fn(() => 42);
      const store = new LiveStore(undefined, now);
      store.dispatch({
        type: 'message.show',
        message: {messageId: 'before', text: 'kept'},
      });
      store.dispatch({type: 'layer.clear', target: 'message'});
      const initial = store.state;
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      const changed: unknown = Reflect.apply(store.dispatch, store, [{type}]);
      expect(changed).toBe(false);
      expect(store.state).toBe(initial);
      expect(store.state.version).toBe(2);
      expect(store.state.canUndo).toBe(true);
      expect(listener).not.toHaveBeenCalled();
      unsubscribe();
      store.dispatch({type: 'clear.undo'});
      expect(store.state.layers.message?.text).toBe('kept');
    },
  );

  it('logs and rejects unsupported types through the application dispatch path', () => {
    const store = new LiveStore();
    const initial = store.state;
    const log = recordingLogger();
    const warn = vi.spyOn(log, 'warn');
    Reflect.apply(dispatchLogged, undefined, [
      store,
      {type: 'fixture.future'},
      log,
    ]);
    expect(store.state).toBe(initial);
    expect(store.state.version).toBe(0);
    expect(warn).toHaveBeenCalledExactlyOnceWith('unhandled live command', {
      type: 'fixture.future',
    });
    dispatchLogged(
      store,
      {type: 'output.set', screenId: 'main', on: true},
      log,
    );
    expect(store.state.version).toBe(1);
    expect(store.state.outputs).toEqual({main: true});
  });
});
