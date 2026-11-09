import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {SongSession} from '@renderer/features/songs/editor/songSession';

/** Heading of the selected source, independent of the rendered controls. */
export function detailsHeading({
  item,
  song,
  library,
  rawCount,
  offset,
  mediaTitle,
}: {
  readonly item: ServiceItem | null;
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
  if (isItemOfKind(item, 'header')) {
    return {title: item.header, kind: '구역', count: 0};
  }
  return {title: mediaTitle ?? '미디어 없음', kind: '미디어', count: rawCount};
}
