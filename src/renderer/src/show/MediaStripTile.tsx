import {memo, useMemo, type JSX} from 'react';
import {mediaLoops} from '@shared/mediaEndRule';
import type {MediaId} from '@shared/schema/ids';
import type {MediaItem} from '@shared/schema/mediaList';
import {MediaTile} from '@renderer/ui';
import type {CopyJob} from './mediaCopyJobs';
import {MediaPreview} from './MediaPreview';
import {UNNAMED_MEDIA} from './useMediaStrip';

export type StripEntry =
  | {
      readonly id: string;
      readonly kind: 'media';
      readonly item: MediaItem;
      readonly copying: number | undefined;
    }
  | {readonly id: string; readonly kind: 'copy'; readonly job: CopyJob};
const SECONDS_PER_MINUTE = 60;

function duration(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / SECONDS_PER_MINUTE)}:${String(whole % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

/** Keeps the host-owned picture stable when only selection or LIVE changes. */
export const MediaStripTile = memo(
  ({
    entry,
    revision,
    missing,
    live,
    selected,
    onMissing,
    videoPreview,
  }: {
    readonly entry: StripEntry;
    readonly revision: number;
    readonly missing: boolean;
    readonly live: boolean;
    readonly selected: boolean;
    readonly onMissing: (id: MediaId, revision: number) => void;
    readonly videoPreview: boolean;
  }): JSX.Element => {
    const picture = useMemo(
      () =>
        entry.kind === 'media' &&
        !missing &&
        entry.copying === undefined &&
        (entry.item.kind !== 'video' || videoPreview) ? (
          <MediaPreview
            key={`${entry.item.id}:${entry.item.kind}:${entry.item.file}`}
            item={entry.item}
            onError={() => onMissing(entry.item.id, revision)}
          />
        ) : undefined,
      [entry, missing, onMissing, revision, videoPreview],
    );
    if (entry.kind === 'copy') {
      return (
        <MediaTile name={entry.job.fileName} copying={entry.job.percent} />
      );
    }
    const {item} = entry;
    return (
      <MediaTile
        name={item.name || UNNAMED_MEDIA}
        picture={picture}
        duration={item.kind === 'video' ? duration(item.duration) : undefined}
        loop={mediaLoops(item)}
        copying={entry.copying}
        missingFile={missing ? item.file : undefined}
        live={live}
        selected={selected}
      />
    );
  },
);
