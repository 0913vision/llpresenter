import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Logger} from '../log';
import {UiStateStore, type UiStateIo} from './uiStateStore';

const DEBOUNCE_MS = 500;

interface DeferredWrite {
  readonly text: string;
  readonly finish: () => void;
  readonly fail: (error: Error) => void;
}

function createStore(): {
  readonly store: UiStateStore;
  readonly started: DeferredWrite[];
  readonly errors: string[];
} {
  const started: DeferredWrite[] = [];
  const errors: string[] = [];
  const io: UiStateIo = {
    read: () => Promise.resolve(null),
    write: (_file, text) =>
      new Promise<void>((resolve, reject) => {
        started.push({text, finish: resolve, fail: reject});
      }),
  };
  const log: Logger = {
    info: () => undefined,
    warn: () => undefined,
    error: message => void errors.push(message),
    flush: () => Promise.resolve(),
  };
  return {
    store: new UiStateStore({file: 'app.json', io, log}),
    started,
    errors,
  };
}

function change(left: number): unknown {
  return {sizeClass: 'normal', left, right: 480};
}

function leftOf(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const layout: unknown = Reflect.get(parsed, 'layout');
  if (typeof layout !== 'object' || layout === null) return undefined;
  const normal: unknown = Reflect.get(layout, 'normal');
  if (typeof normal !== 'object' || normal === null) return undefined;
  const left: unknown = Reflect.get(normal, 'left');
  return typeof left === 'number' ? left : undefined;
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UiStateStore.flush while a write is in flight', () => {
  it('writes a change that arrives during the write before the flush ends', async () => {
    const {store, started} = createStore();
    await store.load();
    store.setLayout(change(310));
    let flushed = false;
    const flushing = store.flush().then(() => {
      flushed = true;
    });
    await settle();
    expect(started).toHaveLength(1);

    store.setLayout(change(330));
    started[0]?.finish();
    await settle();
    expect(started).toHaveLength(2);
    expect(flushed).toBe(false);
    expect(leftOf(started[1]?.text)).toBe(330);

    started[1]?.finish();
    await flushing;
    expect(flushed).toBe(true);
  });

  it('leaves no debounce timer behind after the flush', async () => {
    const {store, started} = createStore();
    await store.load();
    store.setLayout(change(310));
    const flushing = store.flush();
    await settle();
    store.setLayout(change(330));
    started[0]?.finish();
    await settle();
    started[1]?.finish();
    await flushing;

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(started).toHaveLength(2);
  });

  it('drains several changes that arrive one after another', async () => {
    const {store, started} = createStore();
    await store.load();
    store.setLayout(change(310));
    const flushing = store.flush();
    await settle();

    store.setLayout(change(320));
    started[0]?.finish();
    await settle();
    store.setLayout(change(330));
    started[1]?.finish();
    await settle();
    expect(leftOf(started[2]?.text)).toBe(330);
    started[2]?.finish();
    await flushing;
    expect(started).toHaveLength(3);
  });

  it('does not retry a failed write forever, and the flush still ends', async () => {
    const {store, started, errors} = createStore();
    await store.load();
    store.setLayout(change(310));
    const flushing = store.flush();
    await settle();

    store.setLayout(change(330));
    started[0]?.fail(new Error('disk full'));
    await flushing;

    expect(started).toHaveLength(1);
    expect(errors).toEqual(['could not save app.json']);
  });

  it('writes the kept changes again with the next change after a failure', async () => {
    const {store, started} = createStore();
    await store.load();
    store.setLayout(change(310));
    const first = store.flush();
    await settle();
    started[0]?.fail(new Error('locked'));
    await first;

    store.setLayout(change(340));
    const second = store.flush();
    await settle();
    expect(started).toHaveLength(2);
    expect(leftOf(started[1]?.text)).toBe(340);
    started[1]?.finish();
    await second;
  });
});
