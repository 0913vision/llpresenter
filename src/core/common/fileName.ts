const DRIVE = /^[A-Za-z]:/;
const SEPARATORS = /[\\/]/;

/**
 * The name of a Windows file without its folders and its last extension, as
 * Explorer shows it with extensions hidden: `C:\data\Song.txt` is `Song`. A
 * name that starts with its only dot, such as `.txt`, has no extension.
 */
export function fileStem(fileName: string): string {
  const base = fileName.replace(DRIVE, '').split(SEPARATORS).at(-1) ?? '';
  if (base === '..') return base;
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? base : base.slice(0, dot);
}
