import {describe, expect, it, vi} from 'vitest';
import type {
  BibleLookupReply,
  BibleLookupRequest,
} from '@core/schema/bibleLookup';
import {LatestLookup} from './LatestLookup';
import {lookupReply, lookupRequest} from '@core/testing/bibleLookups';

describe('latest Bible lookup', () => {
  it('keeps only the newest pending input and never accepts a stale answer', async () => {
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    const pending = new Promise<BibleLookupReply>(resolve => {
      finish = resolve;
    });
    const lookup = vi
      .fn(async (request: BibleLookupRequest) => lookupReply(request))
      .mockResolvedValue(lookupReply(lookupRequest('창 1:1')))
      .mockReturnValueOnce(pending);
    const accept = vi.fn();
    const fail = vi.fn();
    const reader = new LatestLookup({lookup}, accept, fail);
    reader.request(lookupRequest());
    reader.request(lookupRequest('요 3:17'));
    reader.request(lookupRequest('창 1:1'));
    expect(lookup).toHaveBeenCalledTimes(1);
    finish(lookupReply(lookupRequest()));
    await vi.waitFor(() => expect(accept).toHaveBeenCalledOnce());
    expect(lookup.mock.calls.map(args => args[0].input)).toEqual([
      '요 3:16',
      '창 1:1',
    ]);
    expect(accept).toHaveBeenCalledWith(lookupReply(lookupRequest('창 1:1')));
    expect(fail).not.toHaveBeenCalled();
    reader.dispose();
  });

  it.each(['clear', 'dispose'])(
    'discards pending reads after %s',
    async action => {
      let finish: (reply: BibleLookupReply) => void = () => undefined;
      const pending = new Promise<BibleLookupReply>(resolve => {
        finish = resolve;
      });
      const accept = vi.fn();
      const fail = vi.fn();
      const reader = new LatestLookup({lookup: () => pending}, accept, fail);
      reader.request(lookupRequest());
      if (action === 'clear') reader.request(lookupRequest(''));
      else reader.dispose();
      finish(lookupReply(lookupRequest()));
      await pending;
      expect(accept).not.toHaveBeenCalled();
      expect(fail).not.toHaveBeenCalled();
      reader.dispose();
    },
  );

  it('reports a current failure and accepts the next input', async () => {
    const error = new Error('Invented lookup failure');
    const lookup = vi
      .fn<(request: BibleLookupRequest) => Promise<BibleLookupReply>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(lookupReply(lookupRequest()));
    const accept = vi.fn();
    const fail = vi.fn();
    const reader = new LatestLookup({lookup}, accept, fail);
    reader.request(lookupRequest());
    await vi.waitFor(() =>
      expect(fail).toHaveBeenCalledWith(lookupRequest(), error),
    );
    reader.request(lookupRequest());
    await vi.waitFor(() => expect(accept).toHaveBeenCalledOnce());
    reader.dispose();
  });
});
