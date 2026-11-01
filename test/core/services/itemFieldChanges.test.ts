import {describe, expect, it} from 'vitest';
import {parseService, type ServiceItem} from '@core/schema/service';
import {effectiveArrangement} from '@core/services/itemFieldChanges';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {song} from '@fixtures/core/songs/blockFixtures';

const SONG_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';

function items(): readonly ServiceItem[] {
  return expectSuccess(
    parseService(
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: '30000000-0000-4000-8000-000000000001',
        name: '주일 예배',
        date: '2026-11-01T11:00',
        order: [
          {
            id: '40000000-0000-4000-8000-000000000001',
            song: SONG_ID,
            arrangement: '주일용',
          },
          {
            id: '40000000-0000-4000-8000-000000000002',
            song: SONG_ID,
            arrangement: '지운 구성',
          },
          {id: '40000000-0000-4000-8000-000000000003', header: '찬양'},
        ],
      }),
      'memory.llservice',
    ),
  ).data.order;
}

describe('effectiveArrangement', () => {
  it('plays 기본 for a 구성 the song lost, and for an item that is not a song', () => {
    const [arranged, lost, header] = items();
    if (!arranged || !lost || !header) throw new Error('Missing items');

    expect(effectiveArrangement(arranged, song())).toBe('주일용');
    expect(effectiveArrangement(lost, song())).toBeUndefined();
    expect(effectiveArrangement(header, song())).toBeUndefined();
    expect(effectiveArrangement(arranged, undefined)).toBeUndefined();
    expect(effectiveArrangement(null, song())).toBeUndefined();
  });
});
