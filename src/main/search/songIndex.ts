import {setImmediate} from 'node:timers/promises';
import type {SongChange} from '@shared/schema/contentDocuments';
import {
  LIBRARY_SEARCH_LIMITS,
  type LibrarySearchMatch,
  type LibrarySearchRequest,
  type LibrarySearchResult,
} from '@shared/schema/librarySearch';
import type {Song} from '@shared/schema/song';
import {
  isInitialQuery,
  normalizeSearch,
  searchInitials,
} from '@shared/searchText';

export const INDEX_CHUNK_SIZE = 25;

const TITLES = new Intl.Collator('ko', {numeric: true});

interface SearchText {
  readonly original: string;
  readonly normalized: string;
  readonly initials: string;
}

interface IndexedSong {
  readonly songId: Song['id'];
  readonly title: SearchText;
  readonly slideCount: number;
  readonly lines: readonly SearchText[];
}

function searchable(original: string): SearchText {
  const normalized = normalizeSearch(original);
  return {original, normalized, initials: searchInitials(normalized)};
}

function matches(text: SearchText, query: string, initials: boolean): boolean {
  return (initials ? text.initials : text.normalized).includes(query);
}

function compareSongs(a: IndexedSong, b: IndexedSong): number {
  return (
    TITLES.compare(a.title.original, b.title.original) ||
    a.songId.localeCompare(b.songId)
  );
}

/** One replaceable entry per song; normalized text is reused across queries. */
export class SongSearchIndex {
  private readonly songs = new Map<string, IndexedSong>();
  private readonly ordered: IndexedSong[] = [];

  get size(): number {
    return this.songs.size;
  }

  upsert(song: Song): void {
    this.remove(song.id);
    const entry = {
      songId: song.id,
      title: searchable(song.title),
      slideCount: song.slides.length,
      lines: song.slides.flatMap(slide => slide.lines.map(searchable)),
    };
    this.songs.set(song.id, entry);
    this.ordered.splice(this.insertionPoint(entry), 0, entry);
  }

  remove(songId: string): void {
    const entry = this.songs.get(songId);
    if (entry === undefined) return;
    this.songs.delete(songId);
    const position = this.ordered.indexOf(entry);
    if (position >= 0) this.ordered.splice(position, 1);
  }

  change({songId, document}: SongChange): void {
    if (document === null) this.remove(songId);
    else this.upsert(document.song);
  }

  clear(): void {
    this.songs.clear();
    this.ordered.length = 0;
  }

  search({
    query,
    limit = LIBRARY_SEARCH_LIMITS.default,
  }: LibrarySearchRequest): LibrarySearchResult {
    const normalized = normalizeSearch(query);
    if (query !== '' && normalized === '') return {query, matches: []};
    const maximum = Math.min(limit, LIBRARY_SEARCH_LIMITS.max);
    const initials = isInitialQuery(normalized);
    const results: LibrarySearchMatch[] = [];
    for (const song of this.ordered) {
      const summary = {
        songId: song.songId,
        title: song.title.original,
        slideCount: song.slideCount,
      };
      if (matches(song.title, normalized, initials)) {
        results.push({...summary, match: {kind: 'title'}});
      } else {
        const line = song.lines.find(line =>
          matches(line, normalized, initials),
        );
        if (line !== undefined) {
          results.push({
            ...summary,
            match: {kind: 'lyrics', line: line.original},
          });
        }
      }
      if (results.length === maximum) break;
    }
    return {query, matches: results};
  }

  private insertionPoint(song: IndexedSong): number {
    let start = 0;
    let end = this.ordered.length;
    while (start < end) {
      const middle = Math.floor((start + end) / 2);
      const current = this.ordered[middle];
      if (current !== undefined && compareSongs(current, song) < 0) {
        start = middle + 1;
      } else {
        end = middle;
      }
    }
    return start;
  }
}

/** Builds in bounded batches, yielding to other main-process work between them. */
export async function buildSongSearchIndex(
  songs: Iterable<Song>,
): Promise<SongSearchIndex> {
  const index = new SongSearchIndex();
  let count = 0;
  for (const song of songs) {
    index.upsert(song);
    if (++count % INDEX_CHUNK_SIZE === 0) await setImmediate();
  }
  return index;
}
