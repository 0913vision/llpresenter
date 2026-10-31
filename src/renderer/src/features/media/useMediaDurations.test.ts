import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {
  ServiceChange,
  ServiceDocument,
} from '@core/schema/contentDocuments';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {
  createMediaId,
  createServiceId,
  createServiceItemId,
} from '@core/schema/ids';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {useMediaDurations} from './useMediaDurations';

const serviceId = createServiceId('00000000-0000-4000-8000-000000000001');
const itemId = createServiceItemId('10000000-0000-4000-8000-000000000001');
const mediaId = createMediaId('20000000-0000-4000-8000-000000000001');
const service: ServiceDocument = {
  service: {
    format: 'llservice',
    schemaVersion: 1,
    id: serviceId,
    name: 'Invented service',
    date: '2026-10-26T09:00',
    order: [{id: itemId, media: mediaId}],
  },
  revision: 1,
  access: 'editable',
};
function media(duration = 300, revision = 1): MediaDocument {
  return {
    name: 'media',
    revision,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: mediaId,
          name: 'Invented media',
          kind: 'video',
          file: 'invented.mp4',
          size: 1,
          duration,
        },
      ],
      playlists: [],
      audioPlaylists: [],
    },
  };
}
function setup() {
  let pushService: (change: ServiceChange) => void = () => undefined;
  let pushMedia: (document: MediaDocument) => void = () => undefined;
  const stopService = vi.fn();
  const stopMedia = vi.fn();
  const api = mockLlpApi({
    services: {
      get: () => Promise.resolve(service),
      subscribe: listener => {
        pushService = listener;
        return stopService;
      },
    },
    media: {
      get: () => Promise.resolve(media()),
      subscribe: listener => {
        pushMedia = listener;
        return stopMedia;
      },
    },
  });
  window.llp = api;
  return {
    api,
    stopService,
    stopMedia,
    pushService: (change: ServiceChange) => pushService(change),
    pushMedia: (document: MediaDocument) => pushMedia(document),
  };
}

afterEach(() => {
  delete window.llp;
});

describe('prep media durations', () => {
  it('formats duration and follows both document feeds until unmount', async () => {
    const fixture = setup();
    const report = vi.fn();
    const {result, unmount} = renderHook(() =>
      useMediaDurations(serviceId, true, report),
    );
    await waitFor(() => expect(result.current[itemId]).toBe('5:00'));
    act(() => fixture.pushMedia(media(305, 2)));
    expect(result.current[itemId]).toBe('5:05');
    act(() => fixture.pushMedia(media(300, 1)));
    expect(result.current[itemId]).toBe('5:05');
    act(() =>
      fixture.pushService({
        serviceId,
        document: {
          ...service,
          revision: 2,
          service: {...service.service, order: []},
        },
      }),
    );
    expect(result.current).toEqual({});
    act(() => fixture.pushService({serviceId, document: service}));
    expect(result.current).toEqual({});
    unmount();
    expect(fixture.stopService).toHaveBeenCalledOnce();
    expect(fixture.stopMedia).toHaveBeenCalledOnce();
  });

  it('keeps pushes that arrive before older initial reads', async () => {
    const fixture = setup();
    let resolveRead: (document: MediaDocument) => void = () => undefined;
    vi.spyOn(fixture.api.media, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveRead = resolve;
        }),
    );
    const report = vi.fn();
    const {result} = renderHook(() =>
      useMediaDurations(serviceId, true, report),
    );
    act(() => fixture.pushMedia(media(42, 2)));
    await waitFor(() => expect(result.current[itemId]).toBe('0:42'));
    await act(async () => {
      resolveRead(media());
      await Promise.resolve();
    });
    expect(result.current[itemId]).toBe('0:42');
  });

  it('does not subscribe or read when disabled and reports failed reads to its host', async () => {
    const fixture = setup();
    const get = vi
      .spyOn(fixture.api.services, 'get')
      .mockRejectedValueOnce(new Error('Read failed'));
    const report = vi.fn();
    const {rerender} = renderHook(
      ({enabled}) => useMediaDurations(serviceId, enabled, report),
      {initialProps: {enabled: false}},
    );
    expect(get).not.toHaveBeenCalled();
    rerender({enabled: true});
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({key: 'service-order:details'}),
      ),
    );
  });
});
