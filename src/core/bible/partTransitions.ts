import type {BiblePartTransition} from '../schema/service';
import type {SlideTransition} from '../schema/slideTransition';

type VerseKey = BiblePartTransition['verse'];

export function sameBiblePart(
  entry: BiblePartTransition,
  verse: VerseKey,
  part: number,
): boolean {
  const a = entry.verse;
  return (
    entry.part === part &&
    a.translation === verse.translation &&
    a.book === verse.book &&
    a.chapter === verse.chapter &&
    a.verse === verse.verse
  );
}

export function biblePartEffect(
  entries: readonly BiblePartTransition[] | undefined,
  verse: VerseKey,
  part: number,
): SlideTransition | undefined {
  return entries?.find(entry => sameBiblePart(entry, verse, part))?.transition;
}

export function setBiblePartEffect(
  entries: readonly BiblePartTransition[] | undefined,
  key: {readonly verse: VerseKey; readonly part: number},
  transition: SlideTransition | undefined,
): readonly BiblePartTransition[] {
  const {verse, part} = key;
  const kept = (entries ?? []).filter(
    entry => !sameBiblePart(entry, verse, part),
  );
  return transition === undefined ? kept : [...kept, {verse, part, transition}];
}
