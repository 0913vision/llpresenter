import type {Label} from '../schema/labels';
import type {TextImportDraft} from '../schema/textImport';

export const importHeaderKey = (name: string): string =>
  name.trim().toLowerCase();

export function matchingImportLabel(
  name: string,
  labels: readonly Label[],
): Label | undefined {
  return labels.find(
    label => importHeaderKey(label.name) === importHeaderKey(name),
  );
}

const englishKey = (name: string): string =>
  importHeaderKey(name).replace(/[\s-]/gu, '');

const ENGLISH_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['intro', '전주'],
  ['chorus', '후렴'],
  ['refrain', '후렴'],
  ['prechorus', '프리코러스'],
  ['postchorus', '포스트코러스'],
  ['bridge', '브리지'],
  ['interlude', '간주'],
  ['instrumental', '간주'],
  ['ending', '후주'],
  ['outro', '후주'],
  ['end', '후주'],
];
const KOREAN_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['엔딩', '후주'],
  ['브릿지', '브리지'],
];
const LONG_NAME_LENGTH = 7;

function editDistance(left: string, right: string): number {
  const rows = Array.from({length: left.length + 1}, (_, row) =>
    Array.from({length: right.length + 1}, (_, column) =>
      row === 0 ? column : column === 0 ? row : 0,
    ),
  );
  for (let row = 1; row <= left.length; row++) {
    for (let column = 1; column <= right.length; column++) {
      const current = rows[row];
      if (current === undefined) continue;
      current[column] = Math.min(
        (rows[row - 1]?.[column] ?? 0) + 1,
        (current[column - 1] ?? 0) + 1,
        (rows[row - 1]?.[column - 1] ?? 0) +
          (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        current[column] = Math.min(
          current[column] ?? 0,
          (rows[row - 2]?.[column - 2] ?? 0) + 1,
        );
      }
    }
  }
  return rows[left.length]?.[right.length] ?? 0;
}

/** Suggests a canonical label, accepting only unambiguous English typos. */
export function suggestImportLabel(
  header: string,
  labels: readonly Label[],
): string {
  const exact = matchingImportLabel(header, labels);
  if (exact !== undefined) return exact.name;
  const alias = KOREAN_ALIASES.find(
    ([name]) => name === importHeaderKey(header),
  );
  if (alias !== undefined) {
    return matchingImportLabel(alias[1], labels)?.name ?? header.trim();
  }
  const normalized = englishKey(header);
  const verse = /^([a-z]+)(\d+)$/u.exec(normalized);
  const key = verse?.[1] ?? normalized;
  const candidates =
    verse === null
      ? ENGLISH_LABELS
      : [['verse', `${verse[2]}절`] as const, ['v', `${verse[2]}절`] as const];
  const known = candidates.find(([name]) => name === key);
  const close =
    known === undefined
      ? candidates.filter(
          ([name]) =>
            Math.abs(key.length - name.length) <= 2 &&
            editDistance(key, name) <=
              (name.length >= LONG_NAME_LENGTH ? 2 : 1),
        )
      : [known];
  const suggested = close.length === 1 ? close[0]?.[1] : undefined;
  return suggested === undefined
    ? header.trim()
    : (matchingImportLabel(suggested, labels)?.name ??
        (verse === null ? header.trim() : suggested));
}

/** Keeps bracket section boundaries while replacing labels in an unsaved draft. */
export function applyImportLabelMapping(
  draft: TextImportDraft,
  mapping: ReadonlyMap<string, string>,
): TextImportDraft {
  return {
    ...draft,
    slides: draft.slides.map(slide => {
      const name =
        slide.label === undefined
          ? undefined
          : mapping.get(importHeaderKey(slide.label));
      return name === undefined ? slide : {...slide, label: name.trim()};
    }),
  };
}
