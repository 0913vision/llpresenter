import type {LyricStyleId} from '@shared/schema/ids';
import type {LooksFile} from '@shared/schema/looks';
import {
  parseLyricTextStyle,
  type LyricTextChange,
} from '@shared/schema/textStyle';

export interface LyricStyleEdit {
  readonly id: LyricStyleId;
  readonly change: LyricTextChange;
}

/** Applies validated fields to one shared style without replacing its references. */
export function editLyricStyle(
  file: LooksFile,
  edit: LyricStyleEdit,
): LooksFile | undefined {
  const style = file.lyricStyles.find(style => style.id === edit.id);
  if (style === undefined) return undefined;
  const legacy = {...style, shadow: style.shadow.on, outline: style.outline.on};
  const change = parseLyricTextStyle({...legacy, ...edit.change});
  if (change === undefined) return undefined;
  if (JSON.stringify(change) === JSON.stringify(parseLyricTextStyle(legacy))) {
    return file;
  }
  return {
    ...file,
    lyricStyles: file.lyricStyles.map(style =>
      style.id === edit.id
        ? {
            ...style,
            ...change,
            outline: {...style.outline, on: change.outline},
            shadow: {...style.shadow, on: change.shadow},
          }
        : style,
    ),
  };
}
