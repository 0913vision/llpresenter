import {describe, expect, it, vi} from 'vitest';
import {parse} from 'valibot';
import type {LiveBatch, LiveCommand} from '@shared/commands';
import {lookIdSchema} from '@shared/schema/ids';
import {recordingLogger} from '../displays/testing';
import {dispatchLogged, LiveStore} from './store';
import {defineSlice} from './slice';
import {SliceRegistry} from './sliceRegistry';
import {batchSlice} from './slices/batch';
import {outputsSlice} from './slices/outputs';

const MISSING_LOOK_ID = parse(
  lookIdSchema,
  '00000000-0000-4000-8000-000000000010',
);

const THREE_CLEARS: LiveCommand = {
  type: 'live.batch',
  commands: [
    {type: 'layer.clear', target: 'slide'},
    {type: 'layer.clear', target: 'media'},
    {type: 'layer.clear', target: 'message'},
  ],
};

function populatedStore() {
  let now = 100;
  const store = new LiveStore(undefined, () => now);
  store.dispatch({
    type: 'slide.show',
    slide: {itemId: 'fixture', position: 0, label: null, lines: ['Fixture']},
  });
  store.dispatch({type: 'media.show', media: {mediaId: 'fixture', loop: true}});
  store.dispatch({
    type: 'message.show',
    message: {messageId: 'fixture', text: 'Fixture'},
  });
  return {
    store,
    setTime: (value: number) => {
      now = value;
    },
  };
}

describe('live batches', () => {
  it('skips a missing target, logs it once, and keeps applying and notifying after errors', () => {
    const missing = new Error('The requested Look no longer exists');
    const missingTarget = defineSlice({
      commands: ['look.set'],
      initial: {},
      reduce: () => {
        throw missing;
      },
    });
    const registry = new SliceRegistry([
      batchSlice,
      outputsSlice,
      missingTarget,
    ]);
    const store = new LiveStore(undefined, () => 100, registry);
    const log = recordingLogger();
    store.subscribe(() => {
      throw new Error('Listener failed');
    });
    const listener = vi.fn();
    store.subscribe(listener);
    dispatchLogged(
      store,
      {
        type: 'live.batch',
        commands: [
          {type: 'output.set', screenId: 'main', on: true},
          {type: 'look.set', lookId: MISSING_LOOK_ID},
          {type: 'output.set', screenId: 'stage', on: true},
        ],
      },
      log,
    );
    expect(store.state.outputs).toEqual({main: true, stage: true});
    expect(store.state.version).toBe(1);
    expect(log.messages('warn')).toEqual(['skipped live command']);
    expect(log.entries[0]?.detail).toEqual({type: 'look.set', error: missing});
    expect(log.messages('error')).toEqual(['live state listener failed']);
    expect(listener).toHaveBeenCalledExactlyOnceWith(store.state);
  });

  it.each([
    {commands: []},
    {commands: [{type: 'layer.clear', target: 'all'}]},
    {commands: [{type: 'output.set', screenId: 'main', on: false}]},
  ] satisfies ReadonlyArray<{readonly commands: LiveBatch['commands']}>)(
    'keeps a no-op batch silent: %j',
    ({commands}) => {
      const store = new LiveStore();
      const before = store.state;
      const listener = vi.fn();
      const skipped = vi.fn();
      store.subscribe(listener);
      expect(
        store.dispatch({type: 'live.batch', commands}, undefined, skipped),
      ).toBe(false);
      expect(store.state).toBe(before);
      expect(listener).not.toHaveBeenCalled();
      expect(skipped).not.toHaveBeenCalled();
    },
  );

  it('does not restore old content over a new slide inside the batch', () => {
    const {store} = populatedStore();
    store.dispatch({
      type: 'live.batch',
      commands: [
        {type: 'layer.clear', target: 'slide'},
        {
          type: 'slide.show',
          slide: {itemId: 'new', position: 0, label: null, lines: ['New']},
        },
        {type: 'layer.clear', target: 'media'},
      ],
    });
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers.slide?.itemId).toBe('new');
    expect(store.state.layers.media?.mediaId).toBe('fixture');
    expect(store.state.canUndo).toBe(false);
  });

  it('can undo the grouped clears later in the same transaction', () => {
    const {store} = populatedStore();
    const before = store.state.layers;
    store.dispatch({
      type: 'live.batch',
      commands: [
        {type: 'layer.clear', target: 'slide'},
        {type: 'layer.clear', target: 'media'},
        {type: 'clear.undo'},
      ],
    });
    expect(store.state.layers).toEqual(before);
    expect(store.state.canUndo).toBe(false);
  });

  it('keeps an earlier undo when a following batch changes nothing', () => {
    const {store} = populatedStore();
    const before = store.state.layers;
    store.dispatch(THREE_CLEARS);
    store.dispatch({
      type: 'live.batch',
      commands: [{type: 'layer.clear', target: 'all'}],
    });
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers).toEqual(before);
  });

  it('undoes all three clears with one snapshot and resumes the cleared media', () => {
    const {store, setTime} = populatedStore();
    expect(store.handles('live.batch')).toBe(true);
    const before = store.state.layers;
    setTime(1000);
    expect(store.dispatch(THREE_CLEARS)).toBe(true);
    expect(store.state.layers).toMatchObject({
      slide: null,
      media: null,
      message: null,
    });
    expect(store.state.canUndo).toBe(true);
    setTime(4000);
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers).toEqual({
      ...before,
      media: {...before.media, startedAt: 3100},
    });
    expect(store.state.canUndo).toBe(false);
  });

  it('applies commands in order and broadcasts only the final state with one version', () => {
    const now = vi.fn(() => 100);
    const store = new LiveStore(undefined, now);
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({
      type: 'live.batch',
      commands: [
        {type: 'output.set', screenId: 'main', on: true},
        {type: 'message.show', message: {messageId: 'one', text: 'First'}},
        {type: 'layer.clear', target: 'message'},
        {type: 'message.show', message: {messageId: 'two', text: 'Last'}},
      ],
    });
    expect(store.state.outputs['main']).toBe(true);
    expect(store.state.layers.message?.text).toBe('Last');
    expect(store.state.version).toBe(1);
    expect(listener).toHaveBeenCalledExactlyOnceWith(store.state);
    expect(now).toHaveBeenCalledTimes(1);
    expect(store.state.canUndo).toBe(false);
  });

  it('logs an unsupported child and applies the remaining commands', () => {
    const store = new LiveStore();
    const log = recordingLogger();
    dispatchLogged(
      store,
      {
        type: 'live.batch',
        commands: [
          {type: 'output.set', screenId: 'main', on: true},
          {type: 'look.set', lookId: MISSING_LOOK_ID},
          {type: 'output.set', screenId: 'stage', on: true},
        ],
      },
      log,
    );
    expect(store.state.outputs).toEqual({main: true, stage: true});
    expect(log.messages('warn')).toEqual(['unhandled live command']);
    expect(log.entries[0]?.detail).toEqual({type: 'look.set'});
  });
});
