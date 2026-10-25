import {join, resolve} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {parseService} from '@shared/schema/service';
import {LiveStore, dispatchLogged} from '../live/store';
import {SliceRegistry} from '../live/sliceRegistry';
import {batchSlice} from '../live/slices/batch';
import {clearSlice} from '../live/slices/clear';
import {contentSlice} from '../live/slices/content';
import {macrosSlice} from '../live/slices/macros';
import {ContentStore} from '../store/contentStore';
import {MediaStore} from '../store/mediaStore';
import {resolveLocations} from '../store/locations';
import type {SettingsReader} from '../store/settingsStore';
import {registerMacros} from './register';
import {environment, IDS, macro, uuid} from './testing';

function harness(macros: readonly object[] = [macro()]) {
  const env = environment(macros);
  const {locations} = resolveLocations(
    {},
    {documents: resolve('/macro-tests'), developmentFolder: null},
  );
  const files = {
    write: vi.fn(async () => ({ok: true, value: undefined}) as const),
    remove: vi.fn(async () => ({ok: true, value: undefined}) as const),
  };
  const media = new MediaStore({
    document: {
      name: 'media',
      value: env.media,
      access: 'editable',
      revision: 1,
    },
    file: join(locations.settings, 'media.json'),
    mediaFolder: locations.media,
    developmentFolder: null,
    files,
    log: env.log,
  });
  const services = [IDS.service, uuid(41)].map((id, index) => {
    const parsed = parseService(
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id,
        name: 'Service',
        date: '2026-10-26T10:00',
        order: [{id: IDS.item, media: IDS.video, macro: uuid(20 + index)}],
      }),
      `${id}.llservice`,
    );
    if (!parsed.ok) throw new Error(parsed.error.message);
    return {...parsed.value, file: join(locations.services, `${id}.llservice`)};
  });
  const content = new ContentStore({
    locations,
    songs: new Map(),
    services: new Map(services.map(item => [item.data.id, item])),
    templates: new Map(),
    files,
    log: env.log,
    openServiceId: IDS.service,
    events: {
      songChanged: () => undefined,
      songsListChanged: () => undefined,
      serviceChanged: () => undefined,
      servicesListChanged: () => undefined,
      templateChanged: () => undefined,
      templatesListChanged: () => undefined,
    },
  });
  const store = new LiveStore(
    undefined,
    () => 100,
    new SliceRegistry([batchSlice, clearSlice, contentSlice, macrosSlice]),
  );
  const releaseSettings = store.connectSettings(env.settings);
  onTestFinished(async () => {
    releaseSettings();
    content.dispose();
    await media.dispose();
  });
  const data = {
    settings: Promise.resolve(env.settings),
    media: Promise.resolve(media),
    content: Promise.resolve(content),
  };
  return {...env, store, data, content};
}

describe('macro startup and lifetime', () => {
  it('runs flagged startup macros once in file order after a normal launch', async () => {
    const {store, data, log} = harness([
      macro(IDS.macro, [], {runOnStartup: true}),
      macro(uuid(21)),
      macro(uuid(22), [], {runOnStartup: true}),
    ]);
    const dispatch = vi.spyOn(store, 'dispatch');
    const registration = registerMacros({store, data, log});
    onTestFinished(registration.dispose);
    await registration.ready;
    expect(registration.lastRun?.macroId).toBe(uuid(22));
    expect(dispatch.mock.calls.map(([command]) => command)).toEqual([
      {type: 'macro.run', macroId: IDS.macro},
      {type: 'macro.run', macroId: uuid(22)},
    ]);
    expect(log.messages('error')).toEqual([]);
  });

  it('does not run startup after restore and coalesces concurrent start-fresh calls', async () => {
    const {store, data, log} = harness([
      macro(IDS.macro, [], {runOnStartup: true}),
      macro(uuid(21), [], {runOnStartup: true}),
    ]);
    const dispatch = vi.spyOn(store, 'dispatch');
    const registration = registerMacros({store, data, log, launch: 'restore'});
    onTestFinished(registration.dispose);
    await registration.ready;
    expect(dispatch).not.toHaveBeenCalled();
    await Promise.all([registration.startFresh(), registration.startFresh()]);
    expect(dispatch.mock.calls.map(([command]) => command)).toEqual([
      {type: 'macro.run', macroId: IDS.macro},
      {type: 'macro.run', macroId: uuid(21)},
    ]);
  });

  it('does not attach after disposal while data is still loading', async () => {
    const {store, data, settings, log} = harness([
      macro(IDS.macro, [], {runOnStartup: true}),
    ]);
    let resolveSettings: (value: SettingsReader | null) => void = () =>
      undefined;
    const pending = new Promise<SettingsReader | null>(resolve => {
      resolveSettings = resolve;
    });
    const connect = vi.spyOn(store, 'connectMacros');
    const dispatch = vi.spyOn(store, 'dispatch');
    const registration = registerMacros({
      store,
      data: {...data, settings: pending},
      log,
    });
    registration.dispose();
    resolveSettings(settings);
    await registration.ready;
    await registration.startFresh();
    expect(connect).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('stops the remaining startup list when disposed during a run', async () => {
    const {store, data, log} = harness([
      macro(IDS.macro, [], {runOnStartup: true}),
      macro(uuid(21), [], {runOnStartup: true}),
    ]);
    const real = store.dispatch.bind(store);
    const dispatch = vi
      .spyOn(store, 'dispatch')
      .mockImplementation((...args) => {
        const changed = real(...args);
        registration.dispose();
        return changed;
      });
    const registration = registerMacros({store, data, log});
    await registration.ready;
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('reports failed loading and refuses a requested fresh run explicitly', async () => {
    const {store, data, log} = harness();
    const registration = registerMacros({
      store,
      data: {...data, settings: Promise.resolve(null)},
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

  it('reads item.start from the currently open service after a switch', async () => {
    const {store, data, log, content} = harness([
      macro(IDS.macro, [{kind: 'clearLayer', layer: 'slide'}]),
      macro(uuid(21), [{kind: 'clearLayer', layer: 'media'}]),
    ]);
    const registration = registerMacros({store, data, log, launch: 'restore'});
    onTestFinished(registration.dispose);
    await registration.ready;
    const item = parseLiveCommand({type: 'item.start', itemId: IDS.item});
    if (!item.ok) throw new Error(item.error.message);
    store.dispatch({
      type: 'slide.show',
      slide: {itemId: 'item', position: 0, label: null, lines: ['Before']},
    });
    dispatchLogged(store, item.value, log);
    expect(store.state.layers.slide).toBeNull();
    const next = content.serviceList().find(service => service.id === uuid(41));
    if (next === undefined) throw new Error('Missing second service');
    expect(
      await content.openService(next.id, () => Promise.resolve()),
    ).toMatchObject({ok: true});
    store.dispatch({
      type: 'slide.show',
      slide: {itemId: 'item', position: 0, label: null, lines: ['Kept']},
    });
    store.dispatch({
      type: 'media.show',
      media: {mediaId: IDS.video, loop: true},
    });
    dispatchLogged(store, item.value, log);
    expect(store.state.layers.media).toBeNull();
    expect(store.state.layers.slide?.lines).toEqual(['Kept']);
  });
});
