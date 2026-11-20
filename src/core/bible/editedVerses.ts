import type {BibleCutSelection} from '../schema/bibleCuts';
import type {BibleEditedVerse} from '../schema/biblePassage';
import {normalizeVerse, offsetsFromChunks, wordsOf} from './split/manualSplit';

function segments(text: string, offsets: readonly number[]): BibleEditedVerse {
  const bounds = [0, ...offsets, text.length];
  return bounds.slice(0, -1).map((start, index) => ({
    source: text.slice(start, bounds[index + 1]),
  }));
}

/** Retains the exact spaces and within-word boundaries of the current projection. */
export function snapshotVerseParts(
  text: string,
  parts: ReadonlyArray<{readonly text: string}>,
): BibleEditedVerse | undefined {
  const offsets = offsetsFromChunks(text, parts);
  return offsets === undefined
    ? undefined
    : segments(normalizeVerse(text), offsets);
}

/** Resolves a captured slide by its original text range in the fresh item. */
export function editBibleVersePart(
  parts: BibleEditedVerse,
  captured: BibleEditedVerse,
  change: {readonly index: number; readonly text: string},
): BibleEditedVerse | null {
  const source = captured[change.index]?.source;
  const start = captured
    .slice(0, change.index)
    .reduce((length, part) => length + part.source.length, 0);
  if (source === undefined) return null;
  let offset = 0;
  for (const [index, part] of parts.entries()) {
    if (offset === start && part.source === source) {
      const previous = part.text ?? part.source.trimEnd();
      return previous === change.text
        ? parts
        : parts.map((part, at) =>
            at === index ? {...part, text: change.text} : part,
          );
    }
    offset += part.source.length;
  }
  return null;
}

/** A run of original parts that a manual split may replace without touching edits. */
export interface BibleSplitGap {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export function bibleSplitGap(
  parts: BibleEditedVerse,
  selected: number,
): BibleSplitGap | undefined {
  const at =
    parts[selected]?.text === undefined && parts[selected] !== undefined
      ? selected
      : parts.findIndex(part => part.text === undefined);
  if (at < 0) return undefined;
  let start = at;
  let end = at + 1;
  while (start > 0 && parts[start - 1]?.text === undefined) start--;
  while (end < parts.length && parts[end]?.text === undefined) end++;
  return {
    start,
    end,
    text: parts
      .slice(start, end)
      .map(part => part.source)
      .join('')
      .trimEnd(),
  };
}

export function replaceBibleSplitGap(
  parts: BibleEditedVerse,
  gap: BibleSplitGap,
  choice: BibleCutSelection,
): BibleEditedVerse {
  const original = parts
    .slice(gap.start, gap.end)
    .map(part => part.source)
    .join('');
  const words = wordsOf(gap.text);
  const offsets =
    choice.unit === 'character'
      ? choice.cuts
      : choice.cuts.flatMap(cut => words[cut]?.start ?? []);
  const replacement = segments(original, offsets);
  return [
    ...parts.slice(0, gap.start),
    ...replacement,
    ...parts.slice(gap.end),
  ];
}

/** Moves existing verse-part metadata with the unchanged slides around a new split. */
export function remapBibleSplitPart(
  part: number,
  gap: BibleSplitGap,
  count: number,
): number | undefined {
  if (part <= gap.start) return part;
  if (part > gap.end) return part + count - (gap.end - gap.start);
  return part <= gap.start + count ? part : undefined;
}
