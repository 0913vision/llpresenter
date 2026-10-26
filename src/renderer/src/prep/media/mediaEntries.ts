import type {MediaDocument} from '@shared/schema/mediaEdit';
import type {MediaItem} from '@shared/schema/mediaList';
import type {CopyJob} from '@renderer/show/mediaCopyJobs';

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

const SECONDS_PER_MINUTE = 60;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
const BYTES_PER_UNIT = 1024;

/**
 * The tiles of 모든 미디어: every item in list order, then the files still
 * being imported that haven't joined the list yet.
 */
export function mediaEntries(
  document: MediaDocument | null,
  jobs: readonly CopyJob[],
): readonly MediaEntry[] {
  const items = document?.value.items ?? [];
  const copying = new Map(jobs.map(job => [job.mediaId, job.percent]));
  const listed = new Set(items.map(({id}) => id));
  return [
    ...items.map((item): MediaEntry => ({
      id: item.id,
      kind: 'media',
      item,
      copying: copying.get(item.id),
    })),
    ...jobs
      .filter(job => !listed.has(job.mediaId))
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
