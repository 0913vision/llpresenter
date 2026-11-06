import {
  parseBibleLookupReply,
  parseBibleLookupRequest,
  type BibleLookupReply,
  type BibleLookupRequest,
} from '@core/schema/bibleLookup';
import {
  parseBibleAiRequest,
  parseBibleAiCancel,
  parseBibleAiCancelled,
  parseBibleAiIndex,
  parseBibleAiState,
  type BibleAiRequest,
} from '@core/schema/bibleAi';
import {push, query, request, type IpcPort} from './endpoint';

/** The Bible calls between windows and main. */
export const bibleEndpoints = {
  lookup: request<BibleLookupRequest, BibleLookupReply>('bible:lookup', {
    request: parseBibleLookupRequest,
    reply: (value, sent) => parseBibleLookupReply(sent, value),
  }),
  chooseBoundary: request<BibleAiRequest, number>('bible:choose-boundary', {
    request: parseBibleAiRequest,
    reply: parseBibleAiIndex,
  }),
  cancelBoundary: request('bible:cancel-boundary', {
    request: parseBibleAiCancel,
    reply: parseBibleAiCancelled,
  }),
  llmStatus: query('bible:llm-status', parseBibleAiState),
  llmStatusChanged: push('bible:llm-status-changed', parseBibleAiState),
};

/** The Bible part of `window.llp`. */
export function bibleApi(port: IpcPort) {
  return {
    /** Resolves offline text and book suggestions without changing live output. */
    lookup: port.request(bibleEndpoints.lookup),
    /** Rejects on unavailable AI or a failed request; the verse uses rules. */
    chooseBoundary: port.request(bibleEndpoints.chooseBoundary),
    /** Cancels this window's active and waiting work for the lookup ID. */
    cancelBoundary: port.request(bibleEndpoints.cancelBoundary),
    getLlmStatus: port.query(bibleEndpoints.llmStatus),
    onLlmStatus: port.subscribe(bibleEndpoints.llmStatusChanged),
  };
}

export type BibleApi = ReturnType<typeof bibleApi>;

export type BibleLookupApi = Pick<BibleApi, 'lookup'>;
