import {describe, expect, it, vi} from 'vitest';
import type {LayoutChange} from '@shared/schema/uiState';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {
  createIpcColumnWidthStore,
  createMemoryColumnWidthStore,
} from './columnWidthStore';
import {
  createColumnWidthStore,
  loadColumnWidthStore,
  loadUiState,
} from './loadColumnWidthStore';

describe('createMemoryColumnWidthStore', () => {
  it('returns what was saved, per size class', () => {
    const store = createMemoryColumnWidthStore();
    expect(store.load('normal')).toBeUndefined();
    store.save('normal', {left: 300, right: 500});
    expect(store.load('normal')).toEqual({left: 300, right: 500});
    expect(store.load('wide')).toBeUndefined();
  });
});

describe('createIpcColumnWidthStore', () => {
  const initial = {
    layout: {
      normal: {left: 300, right: 500, columns: 5},
      wide: {left: 320},
    },
  };

  it('loads the saved widths of a size class', () => {
    const store = createIpcColumnWidthStore(initial, () => undefined);
    expect(store.load('normal')).toEqual({left: 300, right: 500});
  });

  it('loads nothing for a class without both widths', () => {
    const store = createIpcColumnWidthStore(initial, () => undefined);
    expect(store.load('wide')).toBeUndefined();
    expect(store.load('narrow')).toBeUndefined();
  });

  it('loads nothing when no layout was saved', () => {
    const store = createIpcColumnWidthStore({}, () => undefined);
    expect(store.load('normal')).toBeUndefined();
  });

  it('sends each save once and loads the new widths afterwards', () => {
    const send = vi.fn<(change: LayoutChange) => void>();
    const store = createIpcColumnWidthStore(initial, send);
    store.save('normal', {left: 340, right: 500});
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      sizeClass: 'normal',
      left: 340,
      right: 500,
    });
    expect(store.load('normal')).toEqual({left: 340, right: 500});
  });

  it('clamps both widths to their ranges after rounding, as the main process requires', () => {
    const send = vi.fn<(change: LayoutChange) => void>();
    const store = createIpcColumnWidthStore({}, send);
    store.save('normal', {left: 399.6, right: 720.4});
    expect(send).toHaveBeenLastCalledWith({
      sizeClass: 'normal',
      left: 400,
      right: 720,
    });
    store.save('normal', {left: 150, right: 100});
    expect(send).toHaveBeenLastCalledWith({
      sizeClass: 'normal',
      left: 200,
      right: 320,
    });
    store.save('normal', {left: 900, right: 2000});
    expect(send).toHaveBeenLastCalledWith({
      sizeClass: 'normal',
      left: 400,
      right: 720,
    });
  });

  it('sends a valid pair when only one column was dragged from an out-of-range saved width', () => {
    const send = vi.fn<(change: LayoutChange) => void>();
    const store = createIpcColumnWidthStore(
      {layout: {normal: {left: 300, right: 900}}},
      send,
    );
    expect(store.load('normal')).toEqual({left: 300, right: 900});
    store.save('normal', {left: 350, right: 900});
    expect(send).toHaveBeenCalledWith({
      sizeClass: 'normal',
      left: 350,
      right: 720,
    });
    expect(store.load('normal')).toEqual({left: 350, right: 720});
  });

  it('sends whole pixels, because the main process rejects fractions', () => {
    const send = vi.fn<(change: LayoutChange) => void>();
    const store = createIpcColumnWidthStore({}, send);
    store.save('narrow', {left: 220.4, right: 359.6});
    expect(send).toHaveBeenCalledWith({
      sizeClass: 'narrow',
      left: 220,
      right: 360,
    });
    expect(store.load('narrow')).toEqual({left: 220, right: 360});
  });
});

describe('loadColumnWidthStore', () => {
  it('keeps the widths in memory without the Electron API', async () => {
    const store = await loadColumnWidthStore(undefined);
    store.save('normal', {left: 300, right: 500});
    expect(store.load('normal')).toEqual({left: 300, right: 500});
  });

  it('starts from the saved state and sends saves to the main process', async () => {
    const setLayout = vi.fn<(change: LayoutChange) => void>();
    const api = fakeLlpApi({
      ui: {
        get: () => Promise.resolve({layout: {wide: {left: 320, right: 560}}}),
        setLayout,
      },
    });
    const store = await loadColumnWidthStore(api);
    expect(store.load('wide')).toEqual({left: 320, right: 560});
    store.save('wide', {left: 330, right: 560});
    expect(setLayout).toHaveBeenCalledWith({
      sizeClass: 'wide',
      left: 330,
      right: 560,
    });
  });

  it('logs the failure and starts from the defaults when the state cannot be read', async () => {
    const write = vi.fn();
    const setLayout = vi.fn<(change: LayoutChange) => void>();
    const api = fakeLlpApi({
      ui: {get: () => Promise.reject(new Error('no answer')), setLayout},
      log: {write},
    });
    const store = await loadColumnWidthStore(api);
    expect(store.load('normal')).toBeUndefined();
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'could not read the UI state',
      }),
    );
    store.save('normal', {left: 300, right: 500});
    expect(setLayout).toHaveBeenCalledTimes(1);
  });
});

describe('loadUiState', () => {
  it('is empty without the Electron API', async () => {
    expect(await loadUiState(undefined)).toEqual({});
  });

  it('returns the state of the main process', async () => {
    const state = {layout: {wide: {left: 320, right: 560, columns: 6}}};
    const api = fakeLlpApi({
      ui: {get: () => Promise.resolve(state), setLayout: () => undefined},
    });
    expect(await loadUiState(api)).toEqual(state);
  });

  it('logs the failure and is empty when the main process cannot answer', async () => {
    const write = vi.fn();
    const api = fakeLlpApi({
      ui: {
        get: () => Promise.reject(new Error('no answer')),
        setLayout: () => undefined,
      },
      log: {write},
    });
    expect(await loadUiState(api)).toEqual({});
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'could not read the UI state',
      }),
    );
  });
});

describe('createColumnWidthStore', () => {
  it('starts from the given state and sends saves through the API', () => {
    const setLayout = vi.fn<(change: LayoutChange) => void>();
    const api = fakeLlpApi({
      ui: {get: () => Promise.resolve({}), setLayout},
    });
    const store = createColumnWidthStore(api, {
      layout: {normal: {left: 300, right: 500}},
    });
    expect(store.load('normal')).toEqual({left: 300, right: 500});
    store.save('normal', {left: 310, right: 500});
    expect(setLayout).toHaveBeenCalledWith({
      sizeClass: 'normal',
      left: 310,
      right: 500,
    });
  });

  it('keeps the widths in memory without the Electron API', () => {
    const store = createColumnWidthStore(undefined, {});
    store.save('wide', {left: 320, right: 560});
    expect(store.load('wide')).toEqual({left: 320, right: 560});
  });
});
