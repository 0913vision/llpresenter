import type {LyricStyleId} from '../schema/ids';
import {parseLooks, type LooksFile, type LyricStyle} from '../schema/looks';
export type LyricEffectsChange =
  | {readonly kind: 'outline'; readonly change: Partial<LyricStyle['outline']>}
  | {readonly kind: 'shadow'; readonly change: Partial<LyricStyle['shadow']>}
  | {
      readonly kind: 'referencePosition';
      readonly value: LyricStyle['referencePosition'];
    };

/** Merge one effect field against the newest queued file, preserving siblings. */
export function editLyricEffects(
  file: LooksFile,
  id: LyricStyleId,
  edit: LyricEffectsChange,
): LooksFile | undefined {
  const previous = file.lyricStyles.find(style => style.id === id);
  if (previous === undefined) return undefined;
  const next =
    edit.kind === 'referencePosition'
      ? {...previous, referencePosition: edit.value}
      : {...previous, [edit.kind]: {...previous[edit.kind], ...edit.change}};
  const parsed = parseLooks(
    JSON.stringify({
      format: file.format,
      schemaVersion: file.schemaVersion,
      current: file.current,
      looks: [],
      lyricStyles: [next],
    }),
    'looks.json',
  );
  if (!parsed.ok) return undefined;
  if (JSON.stringify(next) === JSON.stringify(previous)) return file;
  return {
    ...file,
    lyricStyles: file.lyricStyles.map(style =>
      style.id === id ? next : style,
    ),
  };
}
