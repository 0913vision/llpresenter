import type {MediaItem} from '@core/schema/mediaList';

/** A media item's playback properties as stored. */
export type MediaProps = NonNullable<MediaItem['props']>;

/** The speed a media item plays at when it has none of its own. */
export const DEFAULT_SPEED = 1;

/** The speed range offered by properties and applied by the preview player. */
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;

/** The fit a media item fills the screen with when it has none: 채우기. */
export const DEFAULT_FIT = 'fill';

/** The volume of a media item that has none of its own, 0 to 100. */
export const DEFAULT_VOLUME = 100;

/** The properties panel's values: each stored value, or its default. */
export interface ShownProps {
  readonly end: 'loop' | 'stop';
  readonly start: number;
  /** The range's end; unknown for a file analysis couldn't measure. */
  readonly stop: number | undefined;
  readonly speed: number;
  readonly fit: NonNullable<MediaProps['fit']>;
  readonly audio: boolean;
  readonly volume: number;
}

const SECONDS_PER_MINUTE = 60;
const TIME = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/;

/**
 * The values the properties panel shows. A video starts with its sound off
 * when it has no choice of its own, as imports set it; audio plays its sound.
 */
export function shownProps(item: MediaItem): ShownProps {
  const props = item.props ?? {};
  return {
    end: props.end ?? 'loop',
    start: props.in ?? 0,
    stop: props.out ?? item.duration,
    speed: props.speed ?? DEFAULT_SPEED,
    fit: props.fit ?? DEFAULT_FIT,
    audio: props.audio ?? item.kind !== 'video',
    volume: props.volume ?? DEFAULT_VOLUME,
  };
}

/** A time as minutes, seconds, and tenths, such as 00:30.0 or 12:05.5. */
export function timeText(seconds: number): string {
  const tenths = Math.round(seconds * 10);
  const minutes = Math.floor(tenths / (SECONDS_PER_MINUTE * 10));
  const rest = (tenths - minutes * SECONDS_PER_MINUTE * 10) / 10;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}

/** Reads a typed time, such as 1:05.5, 01:05, or 65; null when it isn't one. */
export function parseTime(text: string): number | null {
  const match = TIME.exec(text.trim());
  if (match === null) return null;
  const [, minutes = '0', seconds = '0'] = match;
  return Number(minutes) * SECONDS_PER_MINUTE + Number(seconds);
}
