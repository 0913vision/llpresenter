import type {Result} from '@shared/result';
import type {LyricStyleId} from '@shared/schema/ids';
import type {LooksFile} from '@shared/schema/looks';
import {DEFAULT_LYRIC_STYLE} from '@renderer/render/lyricStyle';
import {nameProblem} from '../screenEdits';

export const LYRIC_STYLE_LIMIT = 1000;

export type LyricStyleListEdit =
  | {
      readonly kind: 'add';
      readonly id: LyricStyleId;
      readonly source?: LyricStyleId;
    }
  | {readonly kind: 'rename'; readonly id: LyricStyleId; readonly name: string}
  | {readonly kind: 'delete'; readonly id: LyricStyleId};

export type LyricStyleListProblem =
  'missing' | 'duplicate-id' | 'full' | 'used' | 'empty' | 'taken';

/** Checks every Look, including inactive Looks, before a shared preset can be deleted. */
export function lyricStyleIsUsed(file: LooksFile, id: LyricStyleId): boolean {
  return file.looks.some(look =>
    Object.values(look.screens).some(card => card.lyricStyle === id),
  );
}

/** Applies preset lifecycle rules to the latest queued document, retaining unknown fields. */
export function editLyricStyleList(
  file: LooksFile,
  edit: LyricStyleListEdit,
): Result<LooksFile, LyricStyleListProblem> {
  const target = file.lyricStyles.find(style => style.id === edit.id);
  if (edit.kind === 'add') {
    if (target !== undefined) return {ok: false, error: 'duplicate-id'};
    if (file.lyricStyles.length >= LYRIC_STYLE_LIMIT) {
      return {ok: false, error: 'full'};
    }
    const source = file.lyricStyles.find(style => style.id === edit.source);
    if (edit.source !== undefined && source === undefined) {
      return {ok: false, error: 'missing'};
    }
    const names = new Set(file.lyricStyles.map(style => style.name.trim()));
    let name = '새 스타일';
    for (let suffix = 2; names.has(name); suffix++) {
      name = `새 스타일 ${suffix}`;
    }
    return {
      ok: true,
      value: {
        ...file,
        lyricStyles: [
          ...file.lyricStyles,
          {...(source ?? DEFAULT_LYRIC_STYLE), id: edit.id, name},
        ],
      },
    };
  }
  if (target === undefined) return {ok: false, error: 'missing'};
  if (edit.kind === 'rename') {
    const problem = nameProblem(edit.name, file.lyricStyles, edit.id);
    if (problem !== undefined) return {ok: false, error: problem};
    return {
      ok: true,
      value: {
        ...file,
        lyricStyles: file.lyricStyles.map(style =>
          style.id === edit.id ? {...style, name: edit.name.trim()} : style,
        ),
      },
    };
  }
  if (lyricStyleIsUsed(file, edit.id)) return {ok: false, error: 'used'};
  return {
    ok: true,
    value: {
      ...file,
      lyricStyles: file.lyricStyles.filter(style => style.id !== edit.id),
    },
  };
}
