import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import type {
  ServiceDocument,
  SongDocument,
} from '@core/schema/contentDocuments';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {ShowService} from '@core/schema/showService';
import {
  createMediaId,
  createServiceId,
  createServiceItemId,
  createSongGroupId,
  createSongId,
} from '@core/schema/ids';
import {isItemOfKind} from '@core/schema/service';
import {emptyLiveState} from '@core/live/state';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {applyService, openItem, useShow} from '@renderer/state/show';
import {useLive} from '@renderer/platform/live';
import {useSongBackground} from './useSongBackground';

const serviceId = createServiceId('00000000-0000-4000-8000-000000000001');
const itemId = createServiceItemId('10000000-0000-4000-8000-000000000001');
const otherId = createServiceItemId('10000000-0000-4000-8000-000000000002');
const songId = createSongId('20000000-0000-4000-8000-000000000001');
const mediaId = createMediaId('30000000-0000-4000-8000-000000000001');
const defaultId = createMediaId('30000000-0000-4000-8000-000000000002');

function setup() {
  let document: ServiceDocument = {
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: serviceId,
      name: 'Invented service',
      date: '2026-10-26T09:00',
      order: [
        {id: itemId, song: songId},
        {id: otherId, song: songId},
      ],
    },
    revision: 1,
    access: 'editable',
  };
  const song: SongDocument = {
    song: {
      format: 'llsong',
      schemaVersion: 2,
      id: songId,
      title: 'Invented song',
      background: defaultId,
      groups: [
        {
          id: createSongGroupId('00000000-0000-4000-8000-000000000101'),
          name: '',
          slides: [{lines: ['Invented words']}],
        },
      ],
    },
    revision: 1,
    access: 'editable',
  };
  const media: MediaDocument = {
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      playlists: [],
      audioPlaylists: [],
      items: [mediaId, defaultId].map(id => ({
        id,
        name: 'Invented media',
        kind: 'image',
        file: 'invented.png',
        size: 1,
      })),
    },
  };
  const projection = (): ShowService => ({
    id: serviceId,
    name: 'Invented service',
    revision: document.revision,
    readOnly: false,
    tiles: {},
    jumpKeys: {},
    rows: document.service.order.flatMap(item =>
      isItemOfKind(item, 'song')
        ? [
            {
              kind: 'song',
              id: item.id,
              title: 'Invented song',
              background: {mediaId: item.background ?? defaultId, loop: true},
            },
          ]
        : [],
    ),
  });
  const getProjection = vi.fn<() => Promise<ShowService | null>>(() =>
    Promise.resolve(projection()),
  );
  const stops = [vi.fn(), vi.fn(), vi.fn()];
  const send = vi.fn();
  const api = fakeLlpApi({
    live: {send},
    services: {
      get: () => Promise.resolve(document),
      subscribe: () => stops[0] ?? (() => undefined),
    },
    songs: {
      get: () => Promise.resolve(song),
      subscribe: () => stops[1] ?? (() => undefined),
    },
    media: {
      get: () => Promise.resolve(media),
      subscribe: () => stops[2] ?? (() => undefined),
    },
    service: {get: getProjection},
    content: {
      edit: vi.fn((edit: ContentEdit): Promise<EditResult> => {
        if (edit.type !== 'service.update') throw new Error('Unexpected edit');
        document = {
          ...document,
          service: edit.service,
          revision: document.revision + 1,
        };
        return Promise.resolve({
          ok: true,
          value: {id: serviceId, revision: document.revision},
        });
      }),
    },
  });
  window.llp = api;
  applyService(null);
  applyService(projection());
  openItem(itemId);
  const live = emptyLiveState();
  useLive.setState({
    commandVersion: 0,
    state: {
      ...live,
      layers: {
        ...live.layers,
        slide: {itemId, position: 0, label: null, lines: ['Kept lyrics']},
        media: {mediaId: defaultId, loop: true, startedAt: 1},
      },
    },
  });
  const report = vi.fn();
  return {
    api,
    report,
    send,
    stops,
    getProjection,
    projection,
    document,
    mount: () => renderHook(() => useSongBackground(report)),
  };
}

afterEach(() => {
  delete window.llp;
  applyService(null);
});

describe('song background controller', () => {
  it('loads inherited data, writes an override, and changes only live media', async () => {
    const {mount, send, stops} = setup();
    const {result, unmount} = mount();
    await waitFor(() =>
      expect(result.current.view?.song?.song.background).toBe(defaultId),
    );
    act(() => result.current.choose(mediaId));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(send).toHaveBeenCalledWith({
      type: 'media.show',
      media: {mediaId, loop: true},
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(useLive.getState().state?.layers.slide?.lines).toEqual([
      'Kept lyrics',
    ]);
    expect(result.current.view?.item.background).toBe(mediaId);
    unmount();
    for (const stop of stops) expect(stop).toHaveBeenCalledOnce();
  });

  it('saves an off-air item without any output command', async () => {
    const {mount, send} = setup();
    const state = useLive.getState().state;
    if (state === null) throw new Error('Missing state');
    useLive.setState({
      state: {...state, layers: {...state.layers, slide: null}},
    });
    const {result} = mount();
    await waitFor(() => expect(result.current.view).not.toBeNull());
    act(() => result.current.choose(mediaId));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(send).not.toHaveBeenCalled();
    expect(result.current.view?.item.background).toBe(mediaId);
  });

  it('keeps a newer manual media change while a refresh is pending', async () => {
    const {mount, send, getProjection, projection} = setup();
    let finish: (value: ShowService) => void = () => undefined;
    getProjection.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const {result} = mount();
    await waitFor(() => expect(result.current.view).not.toBeNull());
    act(() => result.current.choose(mediaId));
    await waitFor(() => expect(getProjection).toHaveBeenCalledOnce());
    const state = useLive.getState().state;
    if (state === null) throw new Error('Missing state');
    act(() =>
      useLive.setState({
        state: {
          ...state,
          layers: {
            ...state.layers,
            media: {mediaId: 'manual', loop: false, startedAt: 2},
          },
        },
      }),
    );
    await act(async () => {
      finish(projection());
      await Promise.resolve();
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not replace another service when its edit refresh finishes late', async () => {
    const {mount, send, getProjection, projection} = setup();
    let finish: (value: ShowService) => void = () => undefined;
    getProjection.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const {result} = mount();
    await waitFor(() => expect(result.current.view).not.toBeNull());
    act(() => result.current.choose(mediaId));
    await waitFor(() => expect(getProjection).toHaveBeenCalledOnce());
    act(() => applyService({...projection(), id: 'another-service'}));
    await act(async () => {
      finish(projection());
      await Promise.resolve();
    });
    expect(useShow.getState().serviceId).toBe('another-service');
    expect(send).not.toHaveBeenCalled();
  });

  it('reports refused writes without changing output', async () => {
    const {api, mount, send, report} = setup();
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed'},
    });
    const {result} = mount();
    await waitFor(() => expect(result.current.view).not.toBeNull());
    act(() => result.current.choose(mediaId));
    await waitFor(() => expect(report).toHaveBeenCalled());
    expect(send).not.toHaveBeenCalled();
  });

  it('does not let an old item read replace a newly selected item', async () => {
    const {api, mount, document} = setup();
    let finish: (value: ServiceDocument) => void = () => undefined;
    vi.spyOn(api.services, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const {result} = mount();
    act(() => openItem(otherId));
    await waitFor(() => expect(result.current.view?.item.id).toBe(otherId));
    await act(async () => {
      finish(document);
      await Promise.resolve();
    });
    expect(result.current.view?.item.id).toBe(otherId);
  });
});
