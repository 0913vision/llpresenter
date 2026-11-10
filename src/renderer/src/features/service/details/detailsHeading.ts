import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import type {ServiceItemId} from '@core/schema/ids';

/** Counts items following a section header up to the next header. */
export function sectionItemCount(
  order: readonly ServiceItem[],
  headerId: ServiceItemId,
): number {
  const start = order.findIndex(row => row.id === headerId);
  const header = order[start];
  if (header === undefined || !isItemOfKind(header, 'header')) return 0;
  let count = 0;
  for (const row of order.slice(start + 1)) {
    if (isItemOfKind(row, 'header')) break;
    count += 1;
  }
  return count;
}

/** Heading of the selected source, independent of the rendered controls. */
export function detailsHeading({
  item,
  song,
  library,
  rawCount,
  offset,
  mediaTitle,
}: {
  readonly item: Exclude<ServiceItem, {readonly header: string}> | null;
  readonly song: SongSession | null;
  readonly library: ShowLibrarySong | null;
  readonly rawCount: number;
  readonly offset: number;
  readonly mediaTitle: string | undefined;
}): {title: string; kind: string; count: number} {
  if (library !== null) {
    return {title: library.title, kind: '곡', count: library.tiles.length};
  }
  if (item === null) return {title: '', kind: '', count: 0};
  if (isItemOfKind(item, 'song')) {
    return {
      title: song?.document.song.title ?? '없는 곡',
      kind: '곡',
      count: rawCount + offset,
    };
  }
  if (isItemOfKind(item, 'slides')) {
    return {
      title: item.slides.name,
      kind: item.slides.form === 'ad' ? '광고' : '슬라이드',
      count: item.slides.slides.length + offset,
    };
  }
  if (isItemOfKind(item, 'bible')) {
    return {title: item.bible.ref, kind: '성경', count: rawCount + offset};
  }
  return {title: mediaTitle ?? '미디어 없음', kind: '미디어', count: rawCount};
}
