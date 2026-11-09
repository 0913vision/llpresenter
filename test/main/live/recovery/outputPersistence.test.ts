import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {parseRecoveryRecord} from '@core/schema/recoveryRecord';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {LiveStore} from '@main/live/store';
import {RecoveryRecordWriter} from '@main/live/recovery/recordWriter';
import type {WriteProblem} from '@main/store/atomicWrite';
import type {Result} from '@core/common/result';

function setup() {
  const store = new LiveStore();
  const writes: Array<{
    text: string;
    finish: (result: Result<void, WriteProblem>) => void;
  }> = [];
  const writer = new RecoveryRecordWriter({
    store,
    file: 'live.json',
    serviceId: () => null,
    log: recordingLogger(),
    write: (_file, text) =>
      new Promise(resolve => writes.push({text, finish: resolve})),
  });
  store.connectOutputPersistence(state => writer.persistOutputs(state));
  return {store, writer, writes};
}
const OK = {ok: true, value: undefined} as const;

describe('durable output switches', () => {
  it('returns the commit result for a command queued behind another switch', async () => {
    const {store, writes} = setup();
    store.dispatch({type: 'output.set', screenId: MAIN_SCREEN, on: true});
    const off = store.dispatchCommitted({
      type: 'output.set',
      screenId: MAIN_SCREEN,
      on: false,
    });
    const failed = expect(off).rejects.toThrow(
      'Could not save the output switch',
    );
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    writes[0]?.finish(OK);
    await vi.waitFor(() => expect(writes).toHaveLength(2));
    writes[1]?.finish({
      ok: false,
      error: {file: 'live.json', message: 'disk full'},
    });
    await failed;
    expect(store.state.outputs[MAIN_SCREEN]).toBe(true);
    await store.settled();
  });

  it('publishes on and off only after each write and keeps intervening edits ordered', async () => {
    const {store, writer, writes} = setup();
    const states: boolean[] = [];
    store.subscribe(state => states.push(Boolean(state.outputs[MAIN_SCREEN])));
    store.dispatch({type: 'output.set', screenId: MAIN_SCREEN, on: true});
    store.dispatch({type: 'stage.message.set', text: 'queued note'});
    store.dispatch({type: 'output.set', screenId: MAIN_SCREEN, on: false});
    expect(store.state).toEqual(emptyLiveState());
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    writes[0]?.finish(OK);
    await vi.waitFor(() => expect(writes).toHaveLength(2));
    expect(store.state.outputs[MAIN_SCREEN]).toBe(true);
    expect(store.state.stageMessage).toBe('queued note');
    const off = parseRecoveryRecord(writes[1]?.text ?? '');
    expect(off).toMatchObject({
      ok: true,
      value: {
        data: {
          state: {outputs: {[MAIN_SCREEN]: false}, stageMessage: 'queued note'},
        },
      },
    });
    writes[1]?.finish(OK);
    await store.settled();
    expect(store.state.outputs[MAIN_SCREEN]).toBe(false);
    expect(states).toEqual([true, true, false]);
    writer.stop();
  });

  it('keeps a failed switch invisible and applies queued content to the last good state', async () => {
    const {store, writes} = setup();
    const failed = vi.fn();
    store.dispatch(
      {type: 'output.set', screenId: MAIN_SCREEN, on: true},
      failed,
    );
    store.dispatch({type: 'stage.message.set', text: 'still editable'});
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    writes[0]?.finish({
      ok: false,
      error: {file: 'live.json', message: 'disk full'},
    });
    await store.settled();
    expect(store.state.outputs[MAIN_SCREEN]).not.toBe(true);
    expect(store.state.stageMessage).toBe('still editable');
    expect(failed).toHaveBeenCalledOnce();
  });

  it('waits for an older throttled write and never lets it overwrite a switch', async () => {
    const {store, writer, writes} = setup();
    writer.start();
    store.dispatch({type: 'output.set', screenId: MAIN_SCREEN, on: true});
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    writes[0]?.finish(OK);
    await vi.waitFor(() => expect(writes).toHaveLength(2));
    expect(store.state.outputs[MAIN_SCREEN]).not.toBe(true);
    writes[1]?.finish(OK);
    await store.settled();
    writer.stop();
    await writer.settled();
    expect(parseRecoveryRecord(writes[1]?.text ?? '')).toMatchObject({
      ok: true,
      value: {data: {state: {outputs: {[MAIN_SCREEN]: true}}}},
    });
  });

  it('gates output changes inside a batch and bounds the waiting queue', async () => {
    const {store, writes} = setup();
    store.dispatch({
      type: 'live.batch',
      commands: [
        {type: 'stage.message.set', text: 'same transaction'},
        {type: 'output.set', screenId: MAIN_SCREEN, on: true},
      ],
    });
    expect(store.state.stageMessage).toBeUndefined();
    const error = vi.fn();
    for (let i = 0; i < 33; i++) {
      store.dispatch({type: 'stage.message.set', text: String(i)}, error);
    }
    expect(error).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    writes[0]?.finish(OK);
    await store.settled();
    expect(store.state.outputs[MAIN_SCREEN]).toBe(true);
    expect(store.state.stageMessage).toBe('31');
  });
});
