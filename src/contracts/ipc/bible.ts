import {
  parseBibleLookupReply,
  parseBibleLookupRequest,
  type BibleLookupReply,
  type BibleLookupRequest,
} from '@core/schema/bibleLookup';
import {request, type IpcPort} from './endpoint';

/** The Bible calls between windows and main. */
export const bibleEndpoints = {
  lookup: request<BibleLookupRequest, BibleLookupReply>('bible:lookup', {
    request: parseBibleLookupRequest,
    reply: (value, sent) => parseBibleLookupReply(sent, value),
  }),
};

/** The Bible part of `window.llp`. */
export function bibleApi(port: IpcPort) {
  return {
    /** Resolves offline text and book suggestions without changing live output. */
    lookup: port.request(bibleEndpoints.lookup),
  };
}

export type BibleApi = ReturnType<typeof bibleApi>;
