import type {SongGroup} from '../schema/groupedSong';
import {createSongGroupId} from '../schema/ids';
import type {TextImportDraft} from '../schema/textImport';

/**
 * Groups the slides of a text import draft the way the import dialog shows
 * them: a new group starts where the label or the bracket section changes.
 * Each group takes its label as its name.
 */
export function importGroups(
  slides: TextImportDraft['slides'],
  newId: () => string,
): readonly SongGroup[] {
  const groups: SongGroup[] = [];
  let lines: Array<{readonly lines: readonly string[]}> = [];
  let name = '';
  const flush = (): void => {
    if (lines.length === 0) return;
    groups.push({id: createSongGroupId(newId()), name, slides: lines});
    lines = [];
  };
  slides.forEach((slide, index) => {
    const label = slide.label ?? '';
    const previous = slides[index - 1];
    if (
      previous !== undefined &&
      (label !== (previous.label ?? '') ||
        (slide.section !== undefined &&
          previous.section !== undefined &&
          slide.section !== previous.section))
    ) {
      flush();
    }
    name = label;
    lines.push({lines: slide.lines});
  });
  flush();
  return groups;
}
