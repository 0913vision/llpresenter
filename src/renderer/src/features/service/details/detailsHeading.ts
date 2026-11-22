import {displayReference} from '@core/bible/displayReference';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import type {ServiceItemId} from '@core/schema/ids';
import {LITURGY} from '@core/services/liturgy';

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

/** The compact kind and slide-count line below a details title. */
export function detailsKindLine(
  item: ServiceItem | null,
  kind: string,
  count: number,
): string {
  if (item !== null && isItemOfKind(item, 'slides')) {
    if (item.sectionCard !== undefined && item.slides.slides.length === 0) {
      return '타이틀';
    }
    if (item.slides.form === 'blank') return `슬라이드 ${count}개`;
  }
  return `${kind}, 슬라이드 ${count}개`;
}

/** Heading of the selected source, independent of the rendered controls. */
export function detailsHeading({
  item,
  song,
  library,
  count,
  mediaTitle,
}: {
  readonly item: Exclude<ServiceItem, {readonly header: string}> | null;
  readonly song: SongSession | null;
  readonly library: ShowLibrarySong | null;
  readonly count: number;
  readonly mediaTitle: string | undefined;
}): {title: string; kind: string; count: number} {
  if (library !== null) {
    return {title: library.title, kind: '곡', count};
  }
  if (item === null) return {title: '', kind: '', count: 0};
  if (isItemOfKind(item, 'liturgy')) {
    return {
      title: LITURGY[item.liturgy.kind].name,
      kind: '예식문',
      count,
    };
  }
  if (isItemOfKind(item, 'song')) {
    return {
      title: song?.document.song.title ?? '없는 곡',
      kind: '곡',
      count,
    };
  }
  if (isItemOfKind(item, 'slides')) {
    return {
      title: item.slides.name,
      kind: item.slides.form === 'ad' ? '광고' : '슬라이드',
      count,
    };
  }
  if (isItemOfKind(item, 'sermon')) {
    return {
      title: item.sermon.title,
      kind: '설교',
      count,
    };
  }
  if (isItemOfKind(item, 'bible')) {
    return {
      title: displayReference(item.bible.ref),
      kind: '성경',
      count,
    };
  }
  return {title: mediaTitle ?? '미디어 없음', kind: '미디어', count};
}
