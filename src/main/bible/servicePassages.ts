import {bibleVerseTiles} from '@core/bible/bibleTiles';
import type {RecentPassage} from '@core/schema/bible';
import {parseBibleLookupRequest} from '@core/schema/bibleLookup';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {SHOW_SERVICE_LIMITS, type ShowTile} from '@core/schema/showService';
import type {BibleLookupSession} from './lookup';

export interface ServicePassages {
  readonly tiles: ReadonlyMap<string, readonly ShowTile[]>;
  readonly references: ReadonlyMap<string, RecentPassage>;
  readonly unavailable: ReadonlySet<string>;
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
  const references = new Map<string, RecentPassage>();
  const unavailable = new Set<string>();
  const resolved = new Map<
    string,
    Awaited<ReturnType<typeof bible.lookup>> | null
  >();
  for (const item of items) {
    if (options.isCurrent?.() === false) break;
    if (!isItemOfKind(item, 'bible')) continue;
    const request = parseBibleLookupRequest({
      translation: item.bible.translation,
      input: item.bible.ref,
    });
    if (!request.ok) {
      unavailable.add(item.id);
      continue;
    }
    const key = JSON.stringify(request.value);
    if (!resolved.has(key)) {
      try {
        resolved.set(key, await bible.lookup(request.value));
      } catch (error: unknown) {
        options.reportError(error);
        resolved.set(key, null);
      }
    }
    const reply = resolved.get(key);
    if (
      !reply?.result.ok ||
      reply.result.value.verses.length > SHOW_SERVICE_LIMITS.tiles
    ) {
      unavailable.add(item.id);
      continue;
    }
    tiles.set(
      item.id,
      bibleVerseTiles(
        reply.result.value,
        item.bible.verseNumbers,
        item.bible.reference,
      ),
    );
    const {ref, translation} = reply.result.value;
    references.set(item.id, {ref, translation});
  }
  return {tiles, references, unavailable};
}
