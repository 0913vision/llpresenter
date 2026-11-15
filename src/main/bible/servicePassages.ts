import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import type {RecentPassage} from '@core/schema/bible';
import {
  parseBibleLookupRequest,
  type BibleLookupPassage,
} from '@core/schema/bibleLookup';
import {
  isItemOfKind,
  type ServiceItem,
  type ServiceItemOf,
} from '@core/schema/service';
import {SHOW_SERVICE_LIMITS, type ShowTile} from '@core/schema/showService';
import type {BibleLookupSession} from './lookup';

export interface ServicePassages {
  readonly tiles: ReadonlyMap<string, readonly ShowTile[]>;
  readonly references: ReadonlyMap<
    string,
    RecentPassage & {readonly passage?: BibleLookupPassage}
  >;
  readonly unavailable: ReadonlySet<string>;
  readonly slides?: ReadonlyMap<
    string,
    ReadonlyMap<string, BibleLookupPassage>
  >;
}

/** Resolves saved passages sequentially without retaining a second chapter cache. */
export async function resolveServicePassages(
  items: readonly ServiceItem[],
  bible: Pick<BibleLookupSession, 'lookup'>,
  options: {
    readonly reportError: (error: unknown) => void;
    readonly isCurrent?: () => boolean;
  },
): Promise<ServicePassages> {
  const tiles = new Map<string, readonly ShowTile[]>();
  const references = new Map<
    string,
    RecentPassage & {readonly passage?: BibleLookupPassage}
  >();
  const unavailable = new Set<string>();
  const slides = new Map<string, ReadonlyMap<string, BibleLookupPassage>>();
  const resolved = new Map<
    string,
    Awaited<ReturnType<typeof bible.lookup>> | null
  >();
  const load = async (
    translation: string,
    input: string,
  ): Promise<BibleLookupPassage | null> => {
    const request = parseBibleLookupRequest({
      translation,
      input,
    });
    if (!request.ok) return null;
    const key = JSON.stringify(request.value);
    if (!resolved.has(key)) {
      try {
        resolved.set(key, await bible.lookup(request.value, true));
      } catch (error: unknown) {
        options.reportError(error);
        resolved.set(key, null);
      }
    }
    const reply = resolved.get(key);
    return reply?.result.ok ? reply.result.value : null;
  };
  const resolveSlides = async (
    item: ServiceItemOf<'slides'>,
  ): Promise<ReadonlyMap<string, BibleLookupPassage>> => {
    const found = new Map<string, BibleLookupPassage>();
    for (const slide of item.slides.slides) {
      if (options.isCurrent?.() === false) break;
      if (!('verse' in slide)) continue;
      const reference = slide.verse;
      const book = BIBLE_BOOKS.find(book => book.id === reference.book);
      const passage =
        book === undefined
          ? null
          : await load(
              reference.translation,
              `${book.korean} ${reference.chapter}:${reference.verse}`,
            );
      const verse = passage?.verses.find(
        verse =>
          verse.chapter === reference.chapter &&
          verse.verse === reference.verse,
      );
      if (passage === null || verse === undefined) {
        unavailable.add(item.id);
      } else found.set(slide.id, {...passage, verses: [verse]});
    }
    return found;
  };
  for (const item of items) {
    if (options.isCurrent?.() === false) break;
    if (isItemOfKind(item, 'slides')) {
      const found = await resolveSlides(item);
      slides.set(item.id, found);
      continue;
    }
    if (!isItemOfKind(item, 'bible') && !isItemOfKind(item, 'sermon')) continue;
    const settings = isItemOfKind(item, 'sermon')
      ? item.sermon.passage
      : item.bible;
    const passage = await load(settings.translation, settings.ref);
    if (
      passage === null ||
      passage.verses.length + (isItemOfKind(item, 'sermon') ? 2 : 0) >
        SHOW_SERVICE_LIMITS.tiles
    ) {
      unavailable.add(item.id);
      continue;
    }
    tiles.set(item.id, [
      ...(isItemOfKind(item, 'sermon')
        ? [
            {
              label: null,
              labelColor: 'none' as const,
              lines: [item.sermon.title],
              reference: passage.displayRef,
              sermonTitle: true as const,
              ...(item.sermon.openingTransition === undefined
                ? {}
                : {transition: item.sermon.openingTransition}),
            },
          ]
        : []),
      ...bibleVerseTiles(passage, {
        verseNumbers: settings.verseNumbers,
        reference: settings.reference,
        translationName: settings.translationName,
        split: settings.split,
        transition: settings.transition,
      }),
      ...(isItemOfKind(item, 'sermon')
        ? [
            {
              label: null,
              labelColor: 'none' as const,
              lines: [item.sermon.title],
              reference: passage.displayRef,
              sermonTitle: true as const,
              ...(item.sermon.closingTransition === undefined
                ? {}
                : {transition: item.sermon.closingTransition}),
            },
          ]
        : []),
    ]);
    const {ref, translation} = passage;
    references.set(item.id, {ref, translation, passage});
  }
  return {tiles, references, unavailable, slides};
}
