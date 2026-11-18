import type {ShowTile, SongSlideSource} from '../schema/showService';
import type {SongSlide} from '../schema/song';

interface Draft {
  readonly base: string;
  readonly previous: ReadonlySet<string>;
  readonly lines: readonly string[];
}

function keyOf(source: SongSlideSource): string {
  return `${source.songId}:${source.slideId}`;
}

const drafts = new Map<string, Draft>();
const listeners = new Map<string, Set<() => void>>();
const LIMIT = 128;

/** Keeps cached previews in this window on the editor's current lyric draft. */
export function updateSongPictureDraft(
  source: SongSlideSource,
  before: SongSlide,
  after: SongSlide,
): void {
  const key = keyOf(source);
  const text = before.lines.join('\n');
  const older = drafts.get(key);
  const base = older?.base ?? text;
  const recent = [...(older?.previous ?? []), text].slice(-32);
  drafts.delete(key);
  drafts.set(key, {
    base,
    previous: new Set(recent),
    lines: after.lines,
  });
  if (drafts.size > LIMIT) {
    const oldest = drafts.keys().next();
    if (!oldest.done) {
      drafts.delete(oldest.value);
      for (const listener of listeners.get(oldest.value) ?? []) listener();
    }
  }
  for (const listener of listeners.get(key) ?? []) listener();
}

export function acceptSongPictureDrafts(tiles: readonly ShowTile[]): void {
  for (const tile of tiles) {
    if (tile.sourceSlide === undefined) continue;
    const key = keyOf(tile.sourceSlide);
    const draft = drafts.get(key);
    if (draft?.lines.join('\n') !== tile.lines.join('\n')) {
      continue;
    }
    drafts.delete(key);
    for (const listener of listeners.get(key) ?? []) listener();
  }
}

export function songPictureDraft(
  source: SongSlideSource | undefined,
  lines: readonly string[] | undefined,
): Draft | undefined {
  if (source === undefined || lines === undefined) return undefined;
  const draft = drafts.get(keyOf(source));
  const shown = lines.join('\n');
  return draft !== undefined &&
    (draft.base === shown || draft.previous.has(shown))
    ? draft
    : undefined;
}

export function followSongPictureDraft(
  source: SongSlideSource | undefined,
  listener: () => void,
): () => void {
  if (source === undefined) return () => undefined;
  const key = keyOf(source);
  const active = listeners.get(key) ?? new Set<() => void>();
  active.add(listener);
  listeners.set(key, active);
  return () => {
    active.delete(listener);
    if (active.size === 0) listeners.delete(key);
  };
}
