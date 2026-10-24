import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Logger} from '../log';
import {UiStateStore, type UiStateIo} from './uiStateStore';

const FILE = 'app.json';
const DEBOUNCE_MS = 500;

interface Harness {
  readonly store: UiStateStore;
  readonly writes: string[];
  readonly warnings: string[];
  readonly errors: string[];
}

function createHarness(
  initial: string | null,
  options: {readonly writeFails?: boolean; readonly readFails?: boolean} = {},
): Harness {
  const writes: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const io: UiStateIo = {
    read: () =>
      options.readFails
        ? Promise.reject(new Error('read failed'))
        : Promise.resolve(initial),
    write: (_file, text) => {
      if (options.writeFails) return Promise.reject(new Error('write failed'));
      writes.push(text);
      return Promise.resolve();
    },
  };
  const log: Logger = {
    info: () => undefined,
    warn: message => void warnings.push(message),
    error: message => void errors.push(message),
    flush: () => Promise.resolve(),
  };
  const store = new UiStateStore({file: FILE, io, log});
  return {store, writes, warnings, errors};
}

function lastWrite(writes: readonly string[]): unknown {
  const text = writes.at(-1);
  if (text === undefined) throw new Error('Nothing was written');
  return JSON.parse(text);
}

const validFile = JSON.stringify({
  format: 'llapp',
  schemaVersion: 1,
  songsPath: 'D:\\songs',
  futureField: {keep: true},
  layout: {normal: {left: 300, right: 500, columns: 5, extra: 1}},
});

const change = (left: number, right = 480): unknown => ({
  sizeClass: 'normal',
  left,
  right,
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UiStateStore loading', () => {
  it('gives an empty state when the file does not exist', async () => {
    const {store, warnings} = createHarness(null);
    await store.load();
    expect(store.state).toEqual({});
    expect(warnings).toHaveLength(0);
  });

  it('gives the saved layout of a valid file', async () => {
    const {store} = createHarness(validFile);
    await store.load();
    expect(store.state.layout?.normal).toMatchObject({left: 300, right: 500});
  });
});

describe('UiStateStore saving', () => {
  it('merges a change into its size class and keeps every other field', async () => {
    const {store, writes} = createHarness(validFile);
    await store.load();
    store.setLayout(change(350));
    await store.flush();

    expect(writes).toHaveLength(1);
    expect(lastWrite(writes)).toMatchObject({
      songsPath: 'D:\\songs',
      futureField: {keep: true},
      layout: {normal: {left: 350, right: 480, columns: 5, extra: 1}},
    });
  });

  it('keeps the other size classes', async () => {
    const {store, writes} = createHarness(validFile);
    await store.load();
    store.setLayout({sizeClass: 'wide', left: 320, right: 560});
    await store.flush();
    expect(lastWrite(writes)).toMatchObject({
      layout: {
        normal: {left: 300, right: 500},
        wide: {left: 320, right: 560},
      },
    });
  });

  it('creates the file content when the file did not exist', async () => {
    const {store, writes} = createHarness(null);
    await store.load();
    store.setLayout(change(300));
    await store.flush();
    expect(lastWrite(writes)).toMatchObject({
      format: 'llapp',
      schemaVersion: 1,
      layout: {normal: {left: 300, right: 480}},
    });
  });

  it('writes a burst of changes once, after the debounce time', async () => {
    const {store, writes} = createHarness(validFile);
    await store.load();
    store.setLayout(change(310));
    store.setLayout(change(320));
    store.setLayout(change(330));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    expect(writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toHaveLength(1);
    expect(lastWrite(writes)).toMatchObject({
      layout: {normal: {left: 330}},
    });
  });

  it('writes pending changes at once when flushed, and only once', async () => {
    const {store, writes} = createHarness(validFile);
    await store.load();
    store.setLayout(change(310));
    await store.flush();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(writes).toHaveLength(1);
  });

  it('writes nothing when nothing changed', async () => {
    const {store, writes} = createHarness(validFile);
    await store.load();
    await store.flush();
    expect(writes).toHaveLength(0);
  });

  it('drops and logs a change that is out of range or malformed', async () => {
    const {store, writes, warnings} = createHarness(validFile);
    await store.load();
    store.setLayout({sizeClass: 'normal', left: 100, right: 480});
    store.setLayout({sizeClass: 'huge', left: 300, right: 480});
    store.setLayout('nope');
    await store.flush();
    expect(writes).toHaveLength(0);
    expect(warnings).toHaveLength(3);
    expect(store.state.layout?.normal).toMatchObject({left: 300});
  });

  it('logs a failed write without throwing', async () => {
    const {store, errors} = createHarness(validFile, {writeFails: true});
    await store.load();
    store.setLayout(change(310));
    await expect(store.flush()).resolves.toBeUndefined();
    expect(errors).toEqual(['could not save app.json']);
  });

  it('stops the timer when it is disposed', async () => {
    const {store, writes} = createHarness(validFile);
    await store.load();
    store.setLayout(change(310));
    store.dispose();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(writes).toHaveLength(0);
  });
});

describe('UiStateStore with a file it must not replace', () => {
  const unusable: ReadonlyArray<readonly [string, string]> = [
    ['text that is not JSON', '{ broken'],
    ['a file of another kind', JSON.stringify({format: 'other'})],
    [
      'a field that breaks the schema',
      JSON.stringify({format: 'llapp', schemaVersion: 1, songsPath: 5}),
    ],
    [
      'a newer schema version',
      JSON.stringify({
        format: 'llapp',
        schemaVersion: 99,
        layout: {normal: {left: 300, right: 500}},
      }),
    ],
  ];

  it.each(unusable)('never writes %s', async (_name, text) => {
    const {store, writes, warnings} = createHarness(text);
    await store.load();
    store.setLayout(change(310));
    await store.flush();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(writes).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it('keeps the changes of the session in memory', async () => {
    const {store} = createHarness('{ broken');
    await store.load();
    expect(store.state).toEqual({});
    store.setLayout(change(310));
    expect(store.state.layout?.normal).toMatchObject({left: 310, right: 480});
  });

  it('does not write when the file cannot be read', async () => {
    const {store, writes, warnings} = createHarness(validFile, {
      readFails: true,
    });
    await store.load();
    store.setLayout(change(310));
    await store.flush();
    expect(writes).toHaveLength(0);
    expect(warnings).toEqual(['could not read app.json']);
  });
});
