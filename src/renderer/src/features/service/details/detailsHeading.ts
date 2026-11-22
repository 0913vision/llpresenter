import {
  hasSlides,
  isItemOfKind,
  type ServiceItem,
  type SlidesItem,
} from '@core/schema/service';
import type {ServiceItemId} from '@core/schema/ids';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {itemTitle} from '@core/slides/tiles';
import {themeOfSlide} from '@core/theme/themes';
import {useThemes} from '@renderer/platform/themes';

const KINDS: Readonly<Record<SlidesItem['kind'], string>> = {
  song: '곡',
  bible: '성경',
  sermon: '설교',
  liturgy: '예식문',
  notice: '광고',
  blank: '슬라이드',
  media: '미디어',
};

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

/** Whether an item is a title alone. */
function isTitle(item: SlidesItem): boolean {
  const {themes} = useThemes.getState();
  const [only, more] = item.slides;
  return (
    only !== undefined &&
    more === undefined &&
    themeOfSlide(themes, only).purpose === 'title'
  );
}

/** The name of the selected source, and what it is. */
export function detailsHeading(
  item: ServiceItem | undefined,
  library: ShowLibrarySong | null,
  count: number,
): {readonly title: string; readonly line: string} {
  if (library !== null) {
    return {title: library.title, line: `곡, 슬라이드 ${count}개`};
  }
  if (item === undefined || !hasSlides(item)) return {title: '', line: ''};
  const title = itemTitle(item);
  if (isTitle(item)) return {title, line: '타이틀'};
  return {
    title,
    line:
      item.kind === 'blank'
        ? `슬라이드 ${count}개`
        : `${KINDS[item.kind]}, 슬라이드 ${count}개`,
  };
}
