import {
  parseBibleLookupReply,
  parseBibleLookupRequest,
  type BibleLookupRequest,
  type BibleLookupReply,
} from '../schema/bibleLookup';

export function lookupRequest(input = '요 3:16', translation = 'sample') {
  const request = parseBibleLookupRequest({input, translation});
  if (!request.ok) throw new Error('Invalid test lookup');
  return request.value;
}

export function lookupReply(request: BibleLookupRequest): BibleLookupReply {
  const korean = request.input.includes('장');
  const valid =
    request.input.includes(':') || (korean && request.input.endsWith('절'));
  const range = request.input.includes('16-18');
  const ref = request.input.startsWith('창')
    ? '창세기 1:1'
    : range
      ? '요한복음 3:16-18'
      : '요한복음 3:16';
  const verses = range ? [16, 17, 18] : [16];
  const parsed = parseBibleLookupReply(request, {
    ...request,
    suggestions: [
      {
        bookId: 43,
        name: '요한복음',
        input: korean
          ? `요한복음 3장 ${range ? '16-18' : '16'}절`
          : range
            ? '요한복음 3:16-18'
            : '요한복음 3:16',
        ...(valid
          ? {
              resolved: {
                ref: range ? '요한복음 3:16-18' : '요한복음 3:16',
                verseCount: verses.length,
              },
            }
          : {}),
      },
    ],
    result: valid
      ? {
          ok: true,
          value: {
            translation: request.translation,
            ref,
            displayRef: ref,
            verses: verses.map(verse => ({
              chapter: 3,
              verse,
              text: 'Invented verse',
            })),
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
