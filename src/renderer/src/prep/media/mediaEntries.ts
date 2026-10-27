import type {
  AudioPlaylistId,
  MediaId,
  MediaPlaylistId,
} from '@shared/schema/ids';
import type {MediaDocument} from '@shared/schema/mediaEdit';
import type {MediaItem} from '@shared/schema/mediaList';
import type {CopyJob} from './mediaCopyJobs';
import type {MediaLibraryView} from './mediaLibrary';

/** One tile of the media grid: a media item, or a file still being imported. */
export type MediaEntry =
  | {
      readonly id: string;
      readonly kind: 'media';
      readonly item: MediaItem;
      /** How far its copy has come, while it is still imported. */
      readonly copying: number | undefined;
    }
  | {readonly id: string; readonly kind: 'copy'; readonly job: CopyJob};

/** The list the media view shows: 모든 미디어, or a media or audio playlist. */
export type MediaListChoice =
  | {readonly kind: 'all'}
  | {readonly kind: 'media' | 'audio'; readonly id: string};

export const ALL_MEDIA: MediaListChoice = {kind: 'all'};

/** What a playlist without a name is called. */
export const UNNAMED_PLAYLIST = '이름 없는 재생목록';

/** A playlist as the media view shows it, with the list's own ids. */
export type ChosenPlaylist = (
  | {readonly kind: 'media'; readonly id: MediaPlaylistId}
  | {readonly kind: 'audio'; readonly id: AudioPlaylistId}
) & {readonly name: string; readonly items: readonly MediaId[]};

const SECONDS_PER_MINUTE = 60;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
const BYTES_PER_UNIT = 1024;

/** The playlist a choice names, or null for 모든 미디어 or a playlist that is gone. */
export function chosenPlaylist(
  document: MediaDocument | null,
  choice: MediaListChoice,
): ChosenPlaylist | null {
  if (choice.kind === 'all' || document === null) return null;
  if (choice.kind === 'media') {
    const found = document.value.playlists.find(({id}) => id === choice.id);
    return found === undefined
      ? null
      : {kind: 'media', id: found.id, name: found.name, items: found.items};
  }
  const found = document.value.audioPlaylists.find(({id}) => id === choice.id);
  return found === undefined
    ? null
    : {kind: 'audio', id: found.id, name: found.name, items: found.items};
}

/**
 * The tiles of the chosen list: its items in order, then the files still
 * being imported into it that haven't joined it yet. 모든 미디어 shows every
 * item and every import.
 */
export function mediaEntries(
  {document, jobs, destinations}: MediaLibraryView,
  choice: MediaListChoice,
): readonly MediaEntry[] {
  const items = document?.value.items ?? [];
  const copying = new Map(jobs.map(job => [job.mediaId, job.percent]));
  const playlist = chosenPlaylist(document, choice);
  const byId = new Map(items.map(item => [item.id, item]));
  const shown =
    playlist === null
      ? items
      : [...new Set(playlist.items)].flatMap(id => byId.get(id) ?? []);
  const listed = new Set(shown.map(({id}) => id));
  return [
    ...shown.map((item): MediaEntry => ({
      id: item.id,
      kind: 'media',
      item,
      copying: copying.get(item.id),
    })),
    ...jobs
      .filter(
        job =>
          !listed.has(job.mediaId) &&
          (playlist === null || destinations.get(job.mediaId) === playlist.id),
      )
      .map((job): MediaEntry => ({id: job.mediaId, kind: 'copy', job})),
  ];
}

/** A duration as minutes:seconds, such as 0:30 or 12:05. */
export function durationText(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  const whole = Math.floor(seconds);
  const rest = String(whole % SECONDS_PER_MINUTE).padStart(2, '0');
  return `${Math.floor(whole / SECONDS_PER_MINUTE)}:${rest}`;
}

/** A file size with one decimal from KB up, such as 2.1GB or 512B. */
export function sizeText(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit++;
  }
  const amount = unit === 0 ? String(value) : value.toFixed(1);
  return `${amount}${BYTE_UNITS[unit] ?? 'B'}`;
}

/** The media grid's footer, such as 7개 2.1GB. */
export function totalText(items: readonly MediaItem[]): string {
  const bytes = items.reduce((total, {size}) => total + size, 0);
  return `${items.length}개 ${sizeText(bytes)}`;
}
