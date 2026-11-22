import {
  BIBLE_CUTS_LIMITS,
  type BibleCutEntry,
  type BibleCutSelection,
  type BibleCutsFile,
} from '../../schema/bibleCuts';
import type {VerseReference} from '../../schema/slide';
import {normalizeVerse} from './manualSplit';

export function cacheKey(reference: VerseReference): string {
  return `${reference.book}:${reference.chapter}:${reference.verse}`;
}

/** Copible's FNV-1a over normalized UTF-16 text, for change detection only. */
export function textHash(text: string): string {
  const normalized = normalizeVerse(text);
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function entryFor(
  text: string,
  cuts: readonly number[] | BibleCutSelection,
  confirmedAt: string,
): BibleCutEntry {
  const choice = 'cuts' in cuts ? cuts : {cuts};
  return {hash: textHash(text), ...choice, cuts: [...choice.cuts], confirmedAt};
}

export function knownCutsFor(
  file: BibleCutsFile,
  reference: VerseReference,
  text: string,
): readonly number[] | undefined {
  return knownCutEntryFor(file, reference, text)?.cuts;
}

export function knownCutEntryFor(
  file: BibleCutsFile,
  reference: VerseReference,
  text: string,
): BibleCutEntry | undefined {
  const entry = file.entries[reference.translation]?.[cacheKey(reference)];
  return entry?.hash === textHash(text) ? entry : undefined;
}

/** Refuses a full cache without discarding existing confirmations. */
export function saveCuts(
  file: BibleCutsFile,
  reference: VerseReference,
  entry: BibleCutEntry,
): BibleCutsFile | null {
  const translation = file.entries[reference.translation] ?? {};
  const key = cacheKey(reference);
  const total = Object.values(file.entries).reduce(
    (sum, entries) => sum + Object.keys(entries).length,
    0,
  );
  if (translation[key] === undefined && total >= BIBLE_CUTS_LIMITS.entries) {
    return null;
  }
  if (
    file.entries[reference.translation] === undefined &&
    Object.keys(file.entries).length >= BIBLE_CUTS_LIMITS.translations
  ) {
    return null;
  }
  return {
    ...file,
    entries: {
      ...file.entries,
      [reference.translation]: {...translation, [key]: entry},
    },
  };
}
