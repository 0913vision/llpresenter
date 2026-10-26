import {isAbsolute, relative} from 'node:path';

/**
 * How the media list stores a file: relative to the media folder when it lies
 * inside it, else by its full path (spec 02, "Media list").
 */
export function storedPath(folder: string, file: string): string {
  const inside = relative(folder, file);
  return inside !== '' && !inside.startsWith('..') && !isAbsolute(inside)
    ? inside
    : file;
}
