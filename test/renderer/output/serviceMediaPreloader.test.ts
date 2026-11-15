import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {createMediaId} from '@core/schema/ids';
import {ServiceMediaPreloader} from '@renderer/output/serviceMediaPreloader';
import type {ShowService} from '@core/schema/showService';
import {parseServiceDocument} from '@core/schema/contentDocuments';

afterEach(() => vi.restoreAllMocks());

it('decodes backgrounds across the whole service', async () => {
  const first = createMediaId('11111111-1111-4111-8111-111111111111');
  const second = createMediaId('22222222-2222-4222-8222-222222222222');
  const unused = createMediaId('33333333-3333-4333-8333-333333333333');
  const added = createMediaId('44444444-4444-4444-8444-444444444444');
  const base = mockLlpApi();
  const media = await base.media.get();
  const service = {
    ...sampleService,
    rows: [
      {
        kind: 'song' as const,
        id: 'a',
        title: 'A',
        background: {mediaId: first, loop: true},
      },
      {
        kind: 'song' as const,
        id: 'b',
        title: 'B',
        background: {mediaId: second, loop: true},
      },
      {
        kind: 'song' as const,
        id: 'c',
        title: 'C',
        background: {mediaId: unused, loop: true},
      },
    ],
    tiles: {
      a: [{label: null, labelColor: 'none' as const, lines: ['A']}],
      b: [
        {
          label: null,
          labelColor: 'none' as const,
          lines: ['B'],
          transition: {kind: 'wipe' as const, sec: 1},
        },
      ],
      c: [],
    },
  };
  const decoded: string[] = [];
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (
    this: HTMLImageElement,
  ) {
    decoded.push(this.src);
    return Promise.resolve();
  });
  let publish: (value: ShowService) => void = () => undefined;
  const api = mockLlpApi({
    service: {
      get: async () => service,
      subscribe: listener => {
        publish = listener;
        return () => undefined;
      },
    },
    media: {
      get: async () => ({
        ...media,
        value: {
          ...media.value,
          items: [first, second, unused, added].map(id => ({
            id,
            name: '',
            kind: 'image' as const,
            file: `${id}.png`,
            size: 1,
          })),
        },
      }),
    },
  });
  const preloader = new ServiceMediaPreloader(api);
  const callsFor = (id: string): number =>
    decoded.filter(src => src.includes(id)).length;
  await vi.waitFor(() => {
    for (const id of [first, second, unused]) {
      expect(callsFor(id)).toBeGreaterThan(0);
    }
  });
  const before = [first, second, unused].map(callsFor);
  publish({
    ...service,
    rows: [
      ...service.rows,
      {
        kind: 'song',
        id: 'd',
        title: 'D',
        background: {mediaId: added, loop: true},
      },
    ],
  });
  await vi.waitFor(() => expect(callsFor(added)).toBeGreaterThan(0));
  expect([first, second, unused].map(callsFor)).toEqual(before);
  preloader.dispose();
});

it('decodes pictures referenced by item overlays in the open service', async () => {
  const serviceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const rowId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const picture = createMediaId('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  const parsed = parseServiceDocument({
    revision: 1,
    access: 'editable',
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: serviceId,
      name: 'Service',
      date: '2026-11-15T11:30',
      order: [
        {
          id: rowId,
          header: 'Header',
          overlays: [
            {
              id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
              name: 'Picture',
              from: 1,
              to: 1,
              screens: [],
              content: {media: picture, loop: false, sound: false},
            },
          ],
        },
      ],
    },
  });
  if (!parsed.ok || parsed.value === null) throw new Error('Invalid fixture');
  const document = parsed.value;
  const media = await mockLlpApi().media.get();
  const decoded: string[] = [];
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (
    this: HTMLImageElement,
  ) {
    decoded.push(this.src);
    return Promise.resolve();
  });
  const api = mockLlpApi({
    service: {
      get: async () => ({
        ...sampleService,
        id: serviceId,
        rows: [{kind: 'header', id: rowId, title: 'Header'}],
        tiles: {},
      }),
    },
    services: {get: async () => document},
    media: {
      get: async () => ({
        ...media,
        value: {
          ...media.value,
          items: [
            {
              id: picture,
              name: '',
              kind: 'image',
              file: 'overlay.png',
              size: 1,
            },
          ],
        },
      }),
    },
  });
  const preloader = new ServiceMediaPreloader(api);
  await vi.waitFor(() =>
    expect(decoded.some(src => src.includes(picture))).toBe(true),
  );
  preloader.dispose();
});
