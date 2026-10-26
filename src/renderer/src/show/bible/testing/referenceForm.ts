import {selectedBook} from '../referenceFields';
import type {
  BibleLookupRequest,
  BibleLookupReply,
} from '@shared/schema/bibleLookup';
import {resolvePassage} from '../../../../../main/bible/reference';
import {
  passageSource,
  translationFile,
} from '../../../../../main/bible/testFiles';

export async function formLookupReply(
  request: BibleLookupRequest,
): Promise<BibleLookupReply> {
  const source = passageSource(translationFile([1, 43, 49, 60, 61, 62]));
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
