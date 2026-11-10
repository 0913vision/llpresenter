import type {SlideLayer} from '../live/state';
import type {LiveThemeItem} from '../schema/liveTheme';

/** Resolve an empty-song cue: stage prefers its label; broadcast uses only the song title. */
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
  const choices = prefer === 'label' ? [label, title] : [title];
  return choices.find(value => value !== undefined && value !== '');
}
