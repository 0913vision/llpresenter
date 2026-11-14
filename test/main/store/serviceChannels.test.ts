import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {serviceEndpoints} from '@contracts/ipc/service';
import type {EditResult} from '@core/schema/contentEdit';
import {createServiceId, type ServiceId} from '@core/schema/ids';
import type {ShowService} from '@core/schema/showService';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {
  registerServiceChannels,
  MAX_PENDING_SERVICE_SWITCHES,
  type ServiceSession,
} from '@main/store/serviceChannels';

type Handler = (event: unknown, value?: unknown) => unknown;
const handlers = vi.hoisted(() => new Map<string, Handler>());
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      handlers.set(channel, handler),
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
    removeListener: (channel: string) => handlers.delete(channel),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));
const FIRST = createServiceId('00000000-0000-4000-8000-000000000001');
const SECOND = createServiceId('00000000-0000-4000-8000-000000000002');

function handler(channel: string): Handler {
  const found = handlers.get(channel);
  if (found === undefined) throw new Error(`Missing handler ${channel}`);
  return found;
}

function shown(id: string): ShowService {
  return {
    revision: 1,
    id,
    name: `Invented service ${id}`,
    readOnly: false,
    rows: [],
    tiles: {},
    jumpKeys: {},
  };
}

function setup() {
  const log = recordingLogger();
  let openId: string = FIRST;
  const opened = (id: ServiceId): EditResult => ({
    ok: true,
    value: {id, revision: 1},
  });
  const openService = vi.fn<ServiceSession['content']['openService']>(
    async id => {
      openId = id;
      return opened(id);
    },
  );
  const feed = {
    current: vi.fn(() => shown(openId)),
    refresh: vi.fn(() => Promise.resolve()),
  };
  const config = {
    setLastServiceId: vi.fn<(id: ServiceId) => void>(),
    flush: vi.fn(() => Promise.resolve()),
  };
  const channels = registerServiceChannels(
    Promise.resolve({content: {openService}, feed}),
    config,
    log,
  );
  onTestFinished(() => channels.dispose());
  /** Holds the next switch until the returned function is called. */
  const holdNext = () => {
    let release: () => void = () => undefined;
    openService.mockImplementationOnce(async id => {
      await new Promise<void>(resolve => {
        release = resolve;
      });
      openId = id;
      return opened(id);
    });
    return () => release();
  };
  return {openService, feed, config, channels, log, holdNext};
}

const open = (serviceId: unknown) =>
  handler(serviceEndpoints.open.channel)({}, {serviceId});

describe('service open channels', () => {
  it('opens the chosen service, remembers it, and answers with the refreshed projection', async () => {
    const {openService, feed, config} = setup();

    expect(await open(SECOND)).toEqual(shown(SECOND));
    expect(openService).toHaveBeenCalledExactlyOnceWith(
      SECOND,
      expect.any(Function),
    );
    expect(config.setLastServiceId).toHaveBeenCalledExactlyOnceWith(SECOND);
    expect(config.flush).toHaveBeenCalledOnce();
    expect(feed.refresh).toHaveBeenCalled();
  });

  it('reports remembering failures while returning the service that opened', async () => {
    const {config, log} = setup();
    config.flush.mockRejectedValueOnce(new Error('Config unavailable'));

    expect(await open(SECOND)).toEqual(shown(SECOND));
    expect(log.messages('error')).toContain(
      'could not remember the open service',
    );
  });

  it('caps queued switches and keeps reads available while the first one is held', async () => {
    const {openService, config, log, holdNext} = setup();
    const release = holdNext();
    try {
      const pending = Array.from({length: MAX_PENDING_SERVICE_SWITCHES}, () =>
        open(SECOND),
      );
      await vi.waitFor(() => expect(openService).toHaveBeenCalledOnce());
      expect(await open(SECOND)).toBeNull();
      expect(log.messages('warn')).toContain(
        'too many pending service switches',
      );
      expect(await handler(serviceEndpoints.get.channel)({})).toEqual(
        shown(FIRST),
      );
      release();
      await Promise.all(pending);
      expect(config.setLastServiceId).toHaveBeenCalledTimes(
        MAX_PENDING_SERVICE_SWITCHES,
      );
    } finally {
      release();
    }
  });

  it('keeps the current service on a refused switch and on a malformed request', async () => {
    const {openService, config, log} = setup();
    openService.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'not-found', message: 'No service has this id'},
    });

    expect(await open(SECOND)).toBeNull();
    expect(await open('bad')).toBeNull();
    expect(openService).toHaveBeenCalledOnce();
    expect(config.setLastServiceId).not.toHaveBeenCalled();
    expect(log.messages('warn')).toEqual([
      'could not open a service',
      'dropped a malformed service open request',
    ]);
  });

  it('serializes whole switches so simultaneous callers receive their own chosen service', async () => {
    const {openService, config, holdNext} = setup();
    const release = holdNext();
    try {
      const first = open(SECOND);
      const second = open(FIRST);
      await vi.waitFor(() => expect(openService).toHaveBeenCalledOnce());
      release();
      expect(await first).toEqual(shown(SECOND));
      expect(await second).toEqual(shown(FIRST));
      expect(config.setLastServiceId.mock.calls.map(([id]) => id)).toEqual([
        SECOND,
        FIRST,
      ]);
    } finally {
      release();
    }
  });

  it('finishes an accepted switch on close and refuses late loading requests', async () => {
    const {openService, config, channels, holdNext} = setup();
    const release = holdNext();
    try {
      const opening = open(SECOND);
      await vi.waitFor(() => expect(openService).toHaveBeenCalledOnce());
      const closing = channels.dispose();
      expect(handlers.size).toBe(0);
      release();
      expect(await opening).toEqual(shown(SECOND));
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
    const opening = open(SECOND);
    await late.dispose();
    finish(null);
    expect(await reading).toBeNull();
    expect(await opening).toBeNull();
  });
});
