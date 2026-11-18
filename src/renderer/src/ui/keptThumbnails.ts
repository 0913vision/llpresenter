/** The most thumbnails the window keeps loaded at once. */
const LIMIT = 300;

// NOTE(0913vision): A thumbnail loaded once by a plain image is ready at once
// for every later <img> with the same address, so a table or picker that
// mounts again draws its small pictures in its first frame. Tiles load theirs
// differently and do not count.
const kept = new Map<string, HTMLImageElement>();

/** Loads small thumbnails ahead and keeps them ready while the window runs. */
export function keepThumbnails(sources: Iterable<string>): void {
  for (const source of sources) {
    const found = kept.get(source);
    if (found !== undefined) {
      kept.delete(source);
      kept.set(source, found);
      continue;
    }
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    kept.set(source, image);
    if (kept.size > LIMIT) {
      const oldest = kept.keys().next();
      if (!oldest.done) kept.delete(oldest.value);
    }
  }
}
