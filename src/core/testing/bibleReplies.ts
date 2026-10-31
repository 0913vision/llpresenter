import {selectedBook} from '../bible/referenceFields';
import type {BibleLookupRequest, BibleLookupReply} from '../schema/bibleLookup';
import {resolvePassage} from '../bible/reference';
import {passageSource, translationFile} from '../bible/testing/testFiles';

export async function formLookupReply(
  request: BibleLookupRequest,
  bookIds: readonly number[] = [1, 43, 49, 60, 61, 62],
): Promise<BibleLookupReply> {
  const source = passageSource(translationFile(bookIds));
  const book = selectedBook(request.input.split(' ')[0] ?? '');
  const indexed = source.books.find(entry => entry.id === book?.id);
  return {
    ...request,
    suggestions: [],
    ...(indexed
      ? {
          bounds: {
            bookId: indexed.id,
            chapterVerses: indexed.chapters.map(entry => entry.verses),
          },
        }
      : {}),
    result: await resolvePassage(
      {...source, id: request.translation},
      request.input,
    ),
  };
}
