import {join, resolve} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {serviceEndpoints} from '@contracts/ipc/service';
import {createServiceId, type ServiceId} from '@core/schema/ids';
import type {ShowService} from '@core/schema/showService';
import {parseService} from '@core/schema/service';
import {expectSuccess} from '@core/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {ContentStore, type DocumentFiles} from './contentStore';
import {resolveLocations} from './locations';
import {OpenServiceFeed} from './openServiceFeed';
import {
  registerServiceChannels,
  MAX_PENDING_SERVICE_SWITCHES,
  type ServiceSession,
} from './serviceChannels';

type Handler = (event: unknown, value?: unknown) => unknown;
const handlers = vi.hoisted(() => new Map<string, Handler>());
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));
const FIRST = createServiceId('00000000-0000-4000-8000-000000000001');
const SECOND = createServiceId('00000000-0000-4000-8000-000000000002');
const MISSING = createServiceId('00000000-0000-4000-8000-000000000003');

function handler(channel: string): Handler {
  const found = handlers.get(channel);
  if (found === undefined) throw new Error(`Missing handler ${channel}`);
  return found;
}

function setup({readOnlyCurrent = false} = {}) {
  const {locations} = resolveLocations(
    {},
    {documents: resolve('/data'), developmentFolder: null},
  );
  const log = recordingLogger();
  const files: DocumentFiles = {
    write: vi
      .fn<DocumentFiles['write']>()
      .mockResolvedValue({ok: true, value: undefined}),
    remove: vi
      .fn<DocumentFiles['remove']>()
      .mockResolvedValue({ok: true, value: undefined}),
  };
  const write = vi.mocked(files.write);
  const services = [FIRST, SECOND].map((id, index) => {
    const file = join(locations.services, `${id}.llservice`);
    return {
      ...expectSuccess(
        parseService(
          JSON.stringify({
            format: 'llservice',
            schemaVersion: readOnlyCurrent && id === FIRST ? 2 : 1,
            id,
            name: `Invented service ${index}`,
            date: '2026-10-26T10:00',
            order: [],
          }),
          file,
        ),
      ),
      file,
    };
  });
  const content = new ContentStore({
    locations,
    songs: new Map(),
    services: new Map(services.map(service => [service.data.id, service])),
    templates: new Map(),
    files,
    log,
    openServiceId: FIRST,
    events: {
      songChanged: () => undefined,
      songsListChanged: () => undefined,
      serviceChanged: () => undefined,
      servicesListChanged: () => undefined,
      templateChanged: () => undefined,
      templatesListChanged: () => undefined,
    },
  });
  const push = vi.fn<(shown: ShowService | null) => void>();
  const feed = new OpenServiceFeed(
    {
      get serviceId() {
        return content.openServiceId;
      },
      labels: [],
      content,
      backgroundOf: async () => null,
    },
    push,
    error => {
      throw error;
    },
  );
  const config = {
    setLastServiceId: vi.fn<(id: ServiceId) => void>(),
    flush: vi.fn(async () => undefined),
  };
  const channels = registerServiceChannels(
    Promise.resolve({content, feed}),
    config,
    log,
  );
  onTestFinished(async () => {
    await channels.dispose();
    await feed.dispose();
    await content.flush();
    content.dispose();
  });
  return {content, feed, push, config, channels, write, log, locations};
}

describe('service open channels', () => {
  it('opens another service without writing over a read-only current service', async () => {
    const {write, content} = setup({readOnlyCurrent: true});
    expect(
      await handler(serviceEndpoints.open.channel)({}, {serviceId: SECOND}),
    ).toMatchObject({id: SECOND});
    expect(write).not.toHaveBeenCalled();
    expect(content.openServiceId).toBe(SECOND);
  });

  it('reports remembering failures while returning the service that actually opened', async () => {
    const {config, content, log} = setup();
    config.flush.mockRejectedValueOnce(new Error('Config unavailable'));
    expect(
      await handler(serviceEndpoints.open.channel)({}, {serviceId: SECOND}),
    ).toMatchObject({id: SECOND});
    expect(content.openServiceId).toBe(SECOND);
    expect(log.messages('error')).toContain(
      'could not remember the open service',
    );
  });
  it('caps queued switches and keeps reads available while the first save is held', async () => {
    const {write, config, log} = setup();
    let release: () => void = () => undefined;
    write.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => {
        release = resolve;
      });
      return {ok: true, value: undefined};
    });
    try {
      const pending = Array.from({length: MAX_PENDING_SERVICE_SWITCHES}, () =>
        handler(serviceEndpoints.open.channel)({}, {serviceId: SECOND}),
      );
      await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
      expect(
        await handler(serviceEndpoints.open.channel)({}, {serviceId: SECOND}),
      ).toBeNull();
      expect(log.messages('warn')).toContain(
        'too many pending service switches',
      );
      expect(await handler(serviceEndpoints.get.channel)({})).toMatchObject({
        id: FIRST,
      });
      release();
      await Promise.all(pending);
      expect(config.setLastServiceId).toHaveBeenCalledTimes(
        MAX_PENDING_SERVICE_SWITCHES,
      );
    } finally {
      release();
    }
  });
  it('saves and pushes the current service before the chosen projection and updates the active delete guard', async () => {
    const {content, feed, push, config, write, locations} = setup();
    await feed.refresh();
    const current = content.service(FIRST);
    if (current === null) throw new Error('Missing fixture service');
    await content.apply({
      type: 'service.update',
      service: {...current.service, name: 'Updated first'},
      baseRevision: 1,
    });
    expect(
      await handler(serviceEndpoints.open.channel)({}, {serviceId: SECOND}),
    ).toMatchObject({id: SECOND});
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0].target.file).toBe(
      join(locations.services, `${FIRST}.llservice`),
    );
    expect(push.mock.calls.map(([shown]) => shown)).toMatchObject([
      {id: FIRST, name: 'Updated first'},
      {id: SECOND},
    ]);
    expect(config.setLastServiceId).toHaveBeenCalledExactlyOnceWith(SECOND);
    expect(config.flush).toHaveBeenCalledOnce();
    expect(
      await content.apply({type: 'service.delete', serviceId: SECOND}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      (await content.apply({type: 'service.delete', serviceId: FIRST})).ok,
    ).toBe(true);
  });

  it('keeps the current service on unknown IDs, malformed requests, and a failed current save', async () => {
    const {content, config, write, locations} = setup();
    expect(
      await handler(serviceEndpoints.open.channel)({}, {serviceId: MISSING}),
    ).toBeNull();
    expect(
      await handler(serviceEndpoints.open.channel)({}, {serviceId: 'bad'}),
    ).toBeNull();
    expect(write).not.toHaveBeenCalled();
    const current = content.service(FIRST);
    if (current === null) throw new Error('Missing fixture service');
    await content.apply({
      type: 'service.update',
      service: {...current.service, name: 'Unsaved current'},
      baseRevision: 1,
    });
    write.mockResolvedValueOnce({
      ok: false,
      error: {
        file: join(locations.services, `${FIRST}.llservice`),
        message: 'Disk unavailable',
      },
    });
    expect(
      await handler(serviceEndpoints.open.channel)({}, {serviceId: SECOND}),
    ).toBeNull();
    expect(write).toHaveBeenCalledOnce();
    expect(content.openServiceId).toBe(FIRST);
    expect(config.setLastServiceId).not.toHaveBeenCalled();
    expect(await handler(serviceEndpoints.get.channel)({})).toMatchObject({
      id: FIRST,
      name: 'Unsaved current',
    });
  });

  it('serializes whole switches so simultaneous callers receive their own chosen service', async () => {
    const {write, config} = setup();
    let release: () => void = () => undefined;
    write.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => {
        release = resolve;
      });
      return {ok: true, value: undefined};
    });
    try {
      const first = handler(serviceEndpoints.open.channel)(
        {},
        {serviceId: SECOND},
      );
      const second = handler(serviceEndpoints.open.channel)(
        {},
        {serviceId: FIRST},
      );
      await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
      release();
      expect(await first).toMatchObject({id: SECOND});
      expect(await second).toMatchObject({id: FIRST});
      expect(config.setLastServiceId.mock.calls.map(([id]) => id)).toEqual([
        SECOND,
        FIRST,
      ]);
    } finally {
      release();
    }
  });

  it('finishes an accepted switch on close and refuses late loading requests', async () => {
    const {write, config, channels} = setup();
    let release: () => void = () => undefined;
    write.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => {
        release = resolve;
      });
      return {ok: true, value: undefined};
    });
    try {
      const opening = handler(serviceEndpoints.open.channel)(
        {},
        {serviceId: SECOND},
      );
      await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
      const closing = channels.dispose();
      expect(handlers.size).toBe(0);
      release();
      expect(await opening).toMatchObject({id: SECOND});
      await closing;
      expect(config.setLastServiceId).toHaveBeenCalledWith(SECOND);
    } finally {
      release();
    }
    let finish: (session: ServiceSession | null) => void = () => undefined;
    const late = registerServiceChannels(
      new Promise<ServiceSession | null>(resolve => {
        finish = resolve;
      }),
      config,
      recordingLogger(),
    );
    const reading = handler(serviceEndpoints.get.channel)({});
    const opening = handler(serviceEndpoints.open.channel)(
      {},
      {serviceId: SECOND},
    );
    await late.dispose();
    finish(null);
    expect(await reading).toBeNull();
    expect(await opening).toBeNull();
  });
});
