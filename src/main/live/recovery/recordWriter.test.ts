import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@shared/live';
import type {Result} from '@shared/result';
import {createServiceId, type ServiceId} from '@shared/schema/ids';
import {parseRecoveryRecord} from '@shared/schema/recoveryRecord';
import {makeTempDir} from '../../../../test/temp-dir';
import {recordingLogger} from '../../displays/testing';
import type {WriteProblem} from '../../store/atomicWrite';
import {
  openServiceIdOf,
  RECORD_INTERVAL_MS,
  RecoveryRecordWriter,
} from './recordWriter';

const SAVED_AT = Date.parse('2026-10-26T06:00:00+09:00');
const SERVICE = createServiceId('a41e0c52-7e1f-4a2b-8c3d-4e5f60718293');
const MEDIA = {mediaId: 'media', loop: true, startedAt: SAVED_AT - 500};

type Written = Result<void, WriteProblem>;

function fakeStore(initial: LiveState = emptyLiveState()) {
  const listeners = new Set<(state: LiveState) => void>();
  const store = {
    state: initial,
    subscribe(listener: (state: LiveState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    change(next: Partial<LiveState>) {
      store.state = {
        ...store.state,
        ...next,
        version: store.state.version + 1,
      };
      for (const listener of listeners) listener(store.state);
    },
    get listenerCount() {
      return listeners.size;
    },
  };
  return store;
}

function deferredWrite() {
  let finish: (result: Written) => void = () => undefined;
  const promise = new Promise<Written>(resolve => {
    finish = resolve;
  });
  return {promise, finish};
}

function recordOf(text: string | undefined) {
  if (text === undefined) throw new Error('nothing was written');
  const parsed = parseRecoveryRecord(text);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value.data;
}

const OK: Written = {ok: true, value: undefined};

function setup(options: {serviceId?: ServiceId | null} = {}) {
  const store = fakeStore();
  const log = recordingLogger();
  const texts: string[] = [];
  const write = vi.fn(async (_file: string, text: string) => {
    texts.push(text);
    return OK;
  });
  const writer = new RecoveryRecordWriter({
    file: 'live.json',
    store,
    serviceId: () => options.serviceId ?? null,
    log,
    now: () => Date.now(),
    write,
  });
  return {store, log, texts, write, writer};
}

describe('recovery record writer', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'Date']});
    vi.setSystemTime(SAVED_AT);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes a readable record at once, without audio or clear undo', async () => {
    vi.useRealTimers();
    const file = join(await makeTempDir(), 'recovery', 'live.json');
    const store = fakeStore({
      ...emptyLiveState(),
      version: 7,
      canUndo: true,
      outputs: {main: true},
      layers: {
        ...emptyLiveState().layers,
        media: MEDIA,
        audio: {mediaId: 'song audio'},
      },
    });
    const log = recordingLogger();
    const writer = new RecoveryRecordWriter({
      file,
      store,
      serviceId: () => SERVICE,
      log,
      now: () => SAVED_AT,
    });
    writer.start();
    await writer.dispose();
    const record = recordOf(await readFile(file, 'utf8'));
    expect(record).toMatchObject({
      format: 'llrecovery',
      schemaVersion: 1,
      serviceId: SERVICE,
      state: {
        version: 7,
        canUndo: false,
        outputs: {main: true},
        layers: {media: MEDIA, audio: null},
      },
    });
    expect(Date.parse(record.savedAt)).toBe(SAVED_AT);
    expect(log.entries).toEqual([]);
  });

  it('folds the changes of one interval into one write of the latest state', async () => {
    const {store, texts, writer} = setup({serviceId: SERVICE});
    writer.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(texts).toHaveLength(1);
    store.change({outputs: {main: true}});
    store.change({stageMessage: 'Fixture note'});
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(RECORD_INTERVAL_MS - 1);
    expect(texts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(texts).toHaveLength(2);
    expect(recordOf(texts[1]).state).toMatchObject({
      version: 2,
      outputs: {main: true},
      stageMessage: 'Fixture note',
    });
    await vi.advanceTimersByTimeAsync(RECORD_INTERVAL_MS * 5);
    expect(texts).toHaveLength(2);
    await writer.dispose();
  });

  it('keeps one write in flight and follows it with the newest state', async () => {
    const {store, texts, write, writer} = setup();
    const first = deferredWrite();
    write.mockImplementationOnce(async (_file, text) => {
      texts.push(text);
      return first.promise;
    });
    writer.start();
    for (let index = 0; index < 3; index++) {
      store.change({outputs: {main: index % 2 === 0}});
      await vi.advanceTimersByTimeAsync(RECORD_INTERVAL_MS);
    }
    expect(write).toHaveBeenCalledOnce();
    first.finish(OK);
    await vi.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(2);
    expect(recordOf(texts[1]).state.version).toBe(3);
    await writer.dispose();
  });

  it('logs failed writes once until a write succeeds again', async () => {
    const {store, log, write, writer} = setup();
    const failed: Written = {
      ok: false,
      error: {file: 'live.json', message: 'disk full'},
    };
    write.mockResolvedValueOnce(failed).mockResolvedValueOnce(failed);
    writer.start();
    store.change({outputs: {main: true}});
    await vi.advanceTimersByTimeAsync(RECORD_INTERVAL_MS);
    expect(log.messages('warn')).toEqual([
      'could not write the recovery record',
    ]);
    store.change({outputs: {main: false}});
    await vi.advanceTimersByTimeAsync(RECORD_INTERVAL_MS);
    expect(write).toHaveBeenCalledTimes(3);
    expect(log.messages('warn')).toHaveLength(1);
    expect(log.messages('info')).toEqual([
      'the recovery record is written again',
    ]);
    await writer.dispose();
  });

  it('logs a state the record cannot hold and keeps the previous record', async () => {
    const {store, log, write, writer} = setup();
    writer.start();
    await vi.advanceTimersByTimeAsync(0);
    store.change({
      layers: {
        ...emptyLiveState().layers,
        slide: {itemId: 'item', position: -1, label: null, lines: []},
      },
    });
    await vi.advanceTimersByTimeAsync(RECORD_INTERVAL_MS);
    expect(write).toHaveBeenCalledOnce();
    expect(log.messages('warn')).toEqual([
      'could not write the recovery record',
    ]);
    await writer.dispose();
  });

  it('waits for the write in flight on dispose and writes nothing after it', async () => {
    const {store, write, writer} = setup();
    const first = deferredWrite();
    write.mockReturnValueOnce(first.promise);
    writer.start();
    store.change({outputs: {main: true}});
    let disposed = false;
    const disposing = writer.dispose().then(() => {
      disposed = true;
    });
    await vi.advanceTimersByTimeAsync(RECORD_INTERVAL_MS);
    expect(disposed).toBe(false);
    first.finish(OK);
    await disposing;
    expect(store.listenerCount).toBe(0);
    store.change({outputs: {main: false}});
    writer.start();
    await vi.advanceTimersByTimeAsync(RECORD_INTERVAL_MS * 2);
    expect(write).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts once', async () => {
    const {store, write, writer} = setup();
    writer.start();
    writer.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.listenerCount).toBe(1);
    expect(write).toHaveBeenCalledOnce();
    await writer.dispose();
  });
});

describe('open service for the recovery record', () => {
  it('follows the open service once the content is read', async () => {
    const log = recordingLogger();
    let open: string | null = SERVICE;
    const content = {
      get openServiceId() {
        return open;
      },
      storedService: (id: string) =>
        id === SERVICE ? {data: {id: SERVICE}} : undefined,
    };
    let resolve: (value: typeof content) => void = () => undefined;
    const serviceId = openServiceIdOf(
      new Promise(done => {
        resolve = done;
      }),
      log,
    );
    expect(serviceId()).toBeNull();
    resolve(content);
    await vi.waitFor(() => expect(serviceId()).toBe(SERVICE));
    open = 'b52f1d63-8f2a-4b3c-9d4e-5f6071829304';
    expect(serviceId()).toBeNull();
    open = null;
    expect(serviceId()).toBeNull();
  });

  it('logs content that never loads and stays empty', async () => {
    const log = recordingLogger();
    const serviceId = openServiceIdOf(Promise.reject(new Error('broken')), log);
    await vi.waitFor(() =>
      expect(log.messages('error')).toEqual([
        'could not follow the open service for recovery',
      ]),
    );
    expect(serviceId()).toBeNull();
  });
});
