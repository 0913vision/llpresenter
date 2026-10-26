import {
  parseBibleLookupReply,
  parseBibleLookupRequest,
  type BibleLookupRequest,
  type BibleLookupReply,
} from '@shared/schema/bibleLookup';

export function lookupRequest(input = '요 3:16') {
  const request = parseBibleLookupRequest({input, translation: 'sample'});
  if (!request.ok) throw new Error('Invalid test lookup');
  return request.value;
}

export function lookupReply(request: BibleLookupRequest): BibleLookupReply {
  const valid = request.input.includes(':');
  const ref = request.input.startsWith('창') ? '창세기 1:1' : '요한복음 3:16';
  const parsed = parseBibleLookupReply(request, {
    ...request,
    suggestions: [{bookId: 43, name: '요한복음', input: '요한복음 3:16'}],
    result: valid
      ? {
          ok: true,
          value: {
            translation: request.translation,
            ref,
            displayRef: ref,
            verses: [{chapter: 3, verse: 16, text: 'Invented verse'}],
          },
        }
      : {
          ok: false,
          error: {code: 'syntax', message: '알아볼 수 없는 구절입니다'},
        },
  });
  if (!parsed.ok) throw new Error('Invalid test lookup reply');
  return parsed.value;
}
