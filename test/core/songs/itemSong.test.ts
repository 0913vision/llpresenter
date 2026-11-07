import {describe, expect, it} from 'vitest';
import {createServiceItemId, createSongId} from '@core/schema/ids';
import {withServiceItemSong, withSong} from '@core/songs/itemSong';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {parseService} from '@core/schema/service';
import {sampleSong} from '@fixtures/core/songs/blockFixtures';
const OTHER_SONG = createSongId('7a1c2a9e-4b7d-4c1a-9e2f-0123456789ab');
it('switches the source while preserving the independent item deck', () => {
  const song = sampleSong();
  const item = {
    id: createServiceItemId('40000000-0000-4000-8000-000000000001'),
    song: song.id,
    slides: song.slides,
  };
  expect(withSong(item, OTHER_SONG)).toEqual({...item, song: OTHER_SONG});
  expect(withSong(item, song.id)).toBe(item);
  expect(withSong({id: item.id, header: '찬양'}, OTHER_SONG)).toBeNull();
});
describe('withServiceItemSong', () => {
  const service = {
    format: 'llservice',
    schemaVersion: 1,
    id: '30000000-0000-4000-8000-000000000001',
    name: '주일 예배',
    date: '2026-11-01T11:00',
    order: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        song: '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
        slides: [],
      },
      {id: '40000000-0000-4000-8000-000000000002', header: '찬양'},
    ],
  };
  const parsed = expectSuccess(
    parseService(JSON.stringify(service), 'memory.llservice'),
  ).data;
  const [, second] = parsed.order;

  it('switches only the named song item', () => {
    const result = withServiceItemSong(
      parsed,
      createServiceItemId('40000000-0000-4000-8000-000000000001'),
      OTHER_SONG,
    );
    expect(result?.order[0]).toMatchObject({song: OTHER_SONG});
    expect(result?.order[1]).toEqual(second);
  });

  it('answers null for a header or a missing item', () => {
    expect(
      withServiceItemSong(
        parsed,
        createServiceItemId('40000000-0000-4000-8000-000000000002'),
        OTHER_SONG,
      ),
    ).toBeNull();
    expect(
      withServiceItemSong(
        parsed,
        createServiceItemId('40000000-0000-4000-8000-000000000009'),
        OTHER_SONG,
      ),
    ).toBeNull();
  });
});
