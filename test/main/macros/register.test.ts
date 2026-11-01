import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {createMediaId, createServiceItemId} from '@core/schema/ids';
import type {MediaList} from '@core/schema/mediaList';
import type {ServiceItem} from '@core/schema/service';
import type {SettingsReader} from '@core/schema/settingsReader';
import type {LiveStore} from '@main/live/store';
import {registerMacros} from '@main/macros/register';
import type {MacroRunnerOptions} from '@main/macros/runner';
import {recordingLogger} from '@fixtures/main/displays/testing';

const runners = vi.hoisted(() => {
  const state: {
    options: MacroRunnerOptions[];
    startup: string[];
    lastRun: {macroId: string} | null;
  } = {options: [], startup: [], lastRun: null};
  return state;
});

vi.mock('@main/macros/runner', () => ({
  MacroRunner: class {
    constructor(options: MacroRunnerOptions) {
      runners.options.push(options);
    }
    get lastRun() {
      return runners.lastRun;
    }
    startupIds() {
      return runners.startup;
    }
  },
}));

const settings: SettingsReader = {
  get: vi.fn(),
  preferences: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
};
const mediaList: MediaList = {
  format: 'llmedia',
  schemaVersion: 1,
  items: [],
  playlists: [],
  audioPlaylists: [],
};
const ITEM = createServiceItemId('00000000-0000-4000-8000-000000000030');
const FIRST_VIDEO = createMediaId('00000000-0000-4000-8000-000000000009');
const SECOND_VIDEO = createMediaId('00000000-0000-4000-8000-000000000010');

interface MockContent {
  openServiceId: string | null;
  service(
    id: string,
  ): {readonly service: {readonly order: ServiceItem[]}} | null;
}

function mockStore() {
  const release = vi.fn();
  const store = {
    handles: vi.fn<LiveStore['handles']>(() => true),
    dispatch: vi.fn<LiveStore['dispatch']>(() => true),
    connectMacros: vi.fn<LiveStore['connectMacros']>(() => release),
  };
  return {store, release};
}

function mockData(
  settingsReader: Promise<SettingsReader | null> = Promise.resolve(settings),
) {
  const services = new Map<string, {service: {order: ServiceItem[]}}>([
    ['first', {service: {order: [{id: ITEM, media: FIRST_VIDEO}]}}],
    ['second', {service: {order: [{id: ITEM, media: SECOND_VIDEO}]}}],
  ]);
  const content: MockContent = {
    openServiceId: 'first',
    service: id => services.get(id) ?? null,
  };
  return {
    content,
    data: {
      settings: settingsReader,
      media: Promise.resolve({get: () => ({value: mediaList})}),
      content: Promise.resolve(content),
    },
  };
}

function setup(startup: string[] = [], launch?: 'normal' | 'restore') {
  runners.options.length = 0;
  runners.startup = startup;
  runners.lastRun = null;
  const log = recordingLogger();
  const {store, release} = mockStore();
  const {data, content} = mockData();
  return {log, store, release, data, content, launch};
}

function runs(store: ReturnType<typeof mockStore>['store']) {
  return store.dispatch.mock.calls.map(([command]) => command);
}

describe('registerMacros', () => {
  it('connects the runner and runs the startup macros in order after a normal launch', async () => {
    const {log, store, data} = setup(['a', 'b']);
    runners.lastRun = {macroId: 'b'};
    const registration = registerMacros({store, data, log});
    onTestFinished(registration.dispose);
    await registration.ready;

    expect(store.connectMacros).toHaveBeenCalledOnce();
    expect(runs(store)).toEqual([
      {type: 'macro.run', macroId: 'a'},
      {type: 'macro.run', macroId: 'b'},
    ]);
    expect(registration.lastRun).toBe(runners.lastRun);
    expect(log.messages('error')).toEqual([]);
  });

  it('waits for start fresh after a restore and runs the startup list once for concurrent calls', async () => {
    const {log, store, data} = setup(['a', 'b']);
    const registration = registerMacros({store, data, log, launch: 'restore'});
    onTestFinished(registration.dispose);
    await registration.ready;
    expect(store.dispatch).not.toHaveBeenCalled();

    await Promise.all([registration.startFresh(), registration.startFresh()]);
    expect(runs(store)).toEqual([
      {type: 'macro.run', macroId: 'a'},
      {type: 'macro.run', macroId: 'b'},
    ]);
  });

  it('neither connects nor runs when disposed while the data is loading', async () => {
    const {log, store} = setup(['a']);
    let resolveSettings: (value: SettingsReader | null) => void = () =>
      undefined;
    const pending = new Promise<SettingsReader | null>(resolve => {
      resolveSettings = resolve;
    });
    const registration = registerMacros({
      store,
      data: mockData(pending).data,
      log,
    });
    registration.dispose();
    resolveSettings(settings);
    await registration.ready;
    await registration.startFresh();

    expect(store.connectMacros).not.toHaveBeenCalled();
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('stops the startup list and releases the runner when disposed during a run', async () => {
    const {log, store, release, data} = setup(['a', 'b']);
    store.dispatch.mockImplementation(() => {
      registration.dispose();
      return true;
    });
    const registration = registerMacros({store, data, log});
    await registration.ready;

    expect(store.dispatch).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(registration.lastRun).toBeNull();
  });

  it('logs data that could not load and refuses a fresh run', async () => {
    const {log, store} = setup(['a']);
    const registration = registerMacros({
      store,
      data: mockData(Promise.resolve(null)).data,
      log,
    });
    onTestFinished(registration.dispose);
    await registration.ready;

    expect(log.messages('error')).toEqual([
      'could not connect macro execution',
    ]);
    await expect(registration.startFresh()).rejects.toThrow(
      'Macro runtime is unavailable',
    );
  });

  it('gives the runner the item of the open service, the media list, and the store support check', async () => {
    const {log, store, data, content} = setup([], 'restore');
    const registration = registerMacros({store, data, log, launch: 'restore'});
    onTestFinished(registration.dispose);
    await registration.ready;
    const [options] = runners.options;
    if (options === undefined) throw new Error('No runner');

    expect(options.settings).toBe(settings);
    expect(options.media()).toBe(mediaList);
    expect(options.item(ITEM)).toEqual({id: ITEM, media: FIRST_VIDEO});
    content.openServiceId = 'second';
    expect(options.item(ITEM)).toEqual({id: ITEM, media: SECOND_VIDEO});
    content.openServiceId = null;
    expect(options.item(ITEM)).toBeUndefined();
    store.handles.mockReturnValueOnce(false);
    expect(options.supports('clear.undo')).toBe(false);
  });
});
