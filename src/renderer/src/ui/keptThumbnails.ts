/** The most thumbnails the window keeps loaded at once. */
const LIMIT = 300;

// NOTE(0913vision): A thumbnail loaded once by a plain image is ready at once
// for every later <img> with the same address, so a table or picker that
// mounts again draws its small pictures in its first frame. Tiles load theirs
// differently and do not count.
const kept = new Map<string, HTMLImageElement>();

function load(source: string): HTMLImageElement {
  const image = new Image();
  image.decoding = 'async';
  // NOTE(0913vision): A picture that isn't there yet is tried again later.
  image.addEventListener('error', () => {
    if (kept.get(source) === image) kept.delete(source);
  });
  image.src = source;
  return image;
}

/** Keeps a thumbnail as the newest one, and gives it when it is new. */
function keep(source: string): HTMLImageElement | null {
  const found = kept.get(source);
  kept.delete(source);
  const image = found ?? load(source);
  kept.set(source, image);
  if (kept.size > LIMIT) {
    const oldest = kept.keys().next();
    if (!oldest.done) kept.delete(oldest.value);
  }
  return found === undefined ? image : null;
}

/**
 * Loads small thumbnails ahead and keeps them ready while the window runs.
 *
 * @param begin - Called for each that loads now; what it gives is called once
 * that one has loaded or failed.
 */
export function keepThumbnails(
  sources: Iterable<string>,
  begin: () => () => void = () => () => undefined,
): void {
  for (const source of sources) {
    const image = keep(source);
    if (image === null) continue;
    const settled = begin();
    image.addEventListener('load', settled, {once: true});
    image.addEventListener('error', settled, {once: true});
  }
}
