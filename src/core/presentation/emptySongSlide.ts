import type {SlideLayer} from '../live/state';
import type {LiveThemeItem} from '../schema/liveTheme';

/** Resolve the cue for an empty song slide, with screen-specific precedence. */
export function emptySongSlideText(
  slide: SlideLayer | null,
  item: LiveThemeItem | null,
  prefer: 'label' | 'title',
): string | undefined {
  if (
    slide === null ||
    item?.kind !== 'song' ||
    item.contentCleared ||
    slide.sectionCard !== undefined ||
    slide.lines.some(line => line.trim() !== '')
  ) {
    return undefined;
  }
  const label = slide.label?.trim();
  const title = [item.title?.trim(), slide.title?.trim()].find(
    value => value !== undefined && value !== '',
  );
  const choices = prefer === 'label' ? [label, title] : [title, label];
  return choices.find(value => value !== undefined && value !== '');
}
