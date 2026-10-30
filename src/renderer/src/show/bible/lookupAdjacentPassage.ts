import type {LlpApi} from '@shared/ipc';
import type {RecentPassage} from '@shared/schema/bible';
import {withinLookupTimeout} from '@renderer/state/showOutput';
import {
  adjacentVerseRange,
  passageBook,
  type VerseDirection,
} from './adjacentVerses';

/** Reads one additional verse without applying a stale lookup to the view. */
export async function lookupAdjacentPassage({
  passage,
  direction,
  lookup,
  current,
}: {
  readonly passage: RecentPassage;
  readonly direction: VerseDirection;
  readonly lookup: LlpApi['bible']['lookup'];
  readonly current: () => boolean;
}) {
  const book = passageBook(passage);
  if (!book) return null;
  const metadata = await withinLookupTimeout(() =>
    lookup({translation: passage.translation, input: book.korean}),
  );
  if (!current()) return null;
  if (!metadata.bounds) throw new Error('Bible chapter counts are unavailable');
  const input = adjacentVerseRange(passage, metadata.bounds, direction);
  if (input === null) return null;
  const reply = await withinLookupTimeout(() =>
    lookup({translation: passage.translation, input}),
  );
  if (!current()) return null;
  if (!reply.result.ok) throw new Error(reply.result.error.message);
  return reply.result.value;
}
