/**
 * The revision of a media item's thumbnail: it changes when the item's file
 * does (a relink, a replaced file, or one replaced by another of the same
 * size, which `modified` tells), and stays the same otherwise, so a thumbnail
 * URL can be cached for good (spec 02, "Media").
 */
export function thumbnailRevision(item: {
  readonly file: string;
  readonly size: number;
  /** When the file was last changed, in milliseconds; main reads it. */
  readonly modified: number;
}): string {
  // NOTE(0913vision): FNV-1a over the path, size, and time; 32 bits are plenty for
  // the history of one item.
  let hash = 0x811c9dc5;
  for (const char of `${item.file}\n${item.size}\n${item.modified}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
