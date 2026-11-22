import {lyricsSlide} from '@fixtures/core/slides';
// NOTE(0913vision): The hooks below apply to each test file that imports this
// module.
// NOTE(0913vision): The hooks below apply to each test file that imports this
// module.
import {render, screen} from '@testing-library/react';
import {beforeEach, onTestFinished, vi} from 'vitest';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import type {
  ServiceChange,
  ServiceDocument,
} from '@core/schema/contentDocuments';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {
  createServiceId,
  createServiceItemId,
  createSongId,
  type ServiceItemId,
} from '@core/schema/ids';
import {SONG_DRAG_MIME} from '@core/schema/songDrag';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {applyService} from '@renderer/session/show';
import {startOpenServiceSync} from '@renderer/session/openService';
import {useLive} from '@renderer/session/live';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';

export const serviceId = createServiceId(
  '00000000-0000-4000-8000-000000000001',
);
export const headerId = createServiceItemId(
  '10000000-0000-4000-8000-000000000001',
);
export const firstId = createServiceItemId(
  '10000000-0000-4000-8000-000000000002',
);
export const lastId = createServiceItemId(
  '10000000-0000-4000-8000-000000000003',
);
export const emptySectionId = createServiceItemId(
  '10000000-0000-4000-8000-000000000009',
);
export const songId = createSongId('20000000-0000-4000-8000-000000000001');
export const secondHeaderId = createServiceItemId(
  '10000000-0000-4000-8000-000000000004',
);

function songItem(id: ServiceItemId, name: string): ServiceItem {
  return {id, kind: 'song', name, song: songId, slides: []};
}

export function setup(
  workspace: 'show' | 'prep' = 'prep',
  readOnly = false,
  extra: {
    emptySection?: boolean;
    secondSection?: boolean;
    missingSong?: boolean;
    unheaded?: boolean;
    firstItem?: ServiceItem;
  } = {},
) {
  let document: ServiceDocument = {
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: serviceId,
      name: 'Invented service',
      date: '2026-10-26T09:00',
      order: [
        ...(extra.unheaded
          ? []
          : [{id: headerId, kind: 'header' as const, name: '제목'}]),
        extra.firstItem ?? songItem(firstId, '첫 곡'),
        songItem(lastId, '다음 곡'),
        ...(extra.secondSection
          ? [{id: secondHeaderId, kind: 'header' as const, name: '마무리'}]
          : []),
        ...(extra.emptySection
          ? [{id: emptySectionId, kind: 'header' as const, name: '빈 구역'}]
          : []),
      ],
    },
    revision: 1,
    access: readOnly ? 'readOnly' : 'editable',
  };
  const publish = (): void =>
    applyService({
      id: serviceId,
      revision: document.revision,
      name: 'Invented service',
      readOnly,
      rows: document.service.order.map(item =>
        isItemOfKind(item, 'header')
          ? {kind: 'header', id: item.id, title: item.name}
          : {
              kind: 'song',
              id: item.id,
              title: item.id === firstId ? '첫 곡' : '다음 곡',
            },
      ),
      tiles: {},
    });
  const listeners = new Set<(change: ServiceChange) => void>();
  const send = vi.fn();
  const api = mockLlpApi({
    services: {
      get: () => Promise.resolve(document),
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    live: {send},
    songs: {
      get: () =>
        Promise.resolve(
          extra.missingSong
            ? null
            : {
                song: {
                  format: 'llsong',
                  schemaVersion: 1,
                  id: songId,
                  title: 'Invented song',
                  slides: [lyricsSlide(1, '')],
                },
                revision: 1,
                access: 'editable',
              },
        ),
    },
    content: {
      edit: vi.fn((command: ContentEdit): Promise<EditResult> => {
        if (command.type !== 'service.update') {
          throw new Error('Unexpected command');
        }
        document = {
          ...document,
          service: command.service,
          revision: document.revision + 1,
        };
        publish();
        for (const listener of listeners) listener({serviceId, document});
        return Promise.resolve({
          ok: true,
          value: {id: serviceId, revision: document.revision},
        });
      }),
    },
  });
  window.llp = api;
  publish();
  onTestFinished(startOpenServiceSync());
  for (const listener of listeners) listener({serviceId, document});
  const onProblem = vi.fn();
  const onOpenPrep = vi.fn();
  const onShowInLibrary = vi.fn();
  const view = render(
    <ServiceOrderList
      workspace={workspace}
      onProblem={onProblem}
      onOpenPrep={onOpenPrep}
      onShowInLibrary={onShowInLibrary}
    />,
  );
  return {
    api,
    send,
    onProblem,
    onOpenPrep,
    onShowInLibrary,
    document: () => document,
    view,
    ids: () => document.service.order.map(item => item.id),
    list: () => screen.getByRole('listbox', {name: '예배 순서'}),
  };
}

export function transfer(payload = '') {
  return {
    types: payload === '' ? [] : [SONG_DRAG_MIME],
    effectAllowed: 'none',
    dropEffect: 'none',
    setDragImage: vi.fn(),
    setData: vi.fn(),
    getData: () => payload,
  };
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  applyService(null);
  useLive.setState({state: null, lastStartedItemId: null});
});
