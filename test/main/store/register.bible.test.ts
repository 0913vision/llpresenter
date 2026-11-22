import {
  developmentContext,
  mockLog,
  register,
} from '@fixtures/main/store/registerFixtures';
import {parseBibleLookupRequest} from '@core/schema/bibleLookup';
import {describe, expect, it, vi} from 'vitest';
import {BibleLookupSession} from '@main/bible/lookup';

describe('registerStore', () => {
  it('passes the operator lookup flag to the Bible session', async () => {
    const context = await developmentContext();
    const lookup = vi
      .spyOn(BibleLookupSession.prototype, 'lookup')
      .mockRejectedValue(new Error('Invented lookup stop'));
    const store = await register(mockLog(), context, () => true);
    const request = parseBibleLookupRequest({
      translation: 'missing',
      input: '하박국 3:17-19',
    });
    if (!request.ok) throw new Error('Invalid request fixture');
    await expect(
      store.bible.lookup(request.value, false, true),
    ).rejects.toThrow('Invented lookup stop');
    expect(lookup).toHaveBeenCalledWith(request.value, false, true);
    lookup.mockRestore();
    await store.dispose();
  });
});
