import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {createMediaId} from '@core/schema/ids';
import {ServiceMediaPreloader} from '@renderer/output/serviceMediaPreloader';

afterEach(() => vi.restoreAllMocks());

it('decodes backgrounds across the whole service', async () => {
  const first = createMediaId('11111111-1111-4111-8111-111111111111');
  const second = createMediaId('22222222-2222-4222-8222-222222222222');
  const unused = createMediaId('33333333-3333-4333-8333-333333333333');
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
      c: [{label: null, labelColor: 'none' as const, lines: ['C']}],
    },
  };
  const decode = vi
    .spyOn(HTMLImageElement.prototype, 'decode')
    .mockResolvedValue(undefined);
  const api = mockLlpApi({
    service: {get: async () => service},
    media: {
      get: async () => ({
        ...media,
        value: {
          ...media.value,
          items: [first, second, unused].map(id => ({
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
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(3));
  preloader.dispose();
});
