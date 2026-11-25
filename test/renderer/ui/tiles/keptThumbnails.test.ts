import {afterEach, beforeEach, expect, it, vi, type MockInstance} from 'vitest';

let listen: MockInstance<HTMLImageElement['addEventListener']>;

beforeEach(() => {
  vi.resetModules();
  listen = vi.spyOn(HTMLImageElement.prototype, 'addEventListener');
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The pictures the module made since `from` listen calls, in order. */
function made(from = 0): HTMLImageElement[] {
  return [
    ...new Set(
      listen.mock.contexts
        .slice(from)
        .filter(context => context instanceof HTMLImageElement),
    ),
  ];
}

function sources(images: readonly HTMLImageElement[]): Array<string | null> {
  return images.map(image => image.getAttribute('src'));
}

async function keeper() {
  return (await import('@renderer/ui/tiles/keptThumbnails')).keepThumbnails;
}

function counter() {
  let begun = 0;
  let settled = 0;
  const begin = (): (() => void) => {
    begun++;
    return () => {
      settled++;
    };
  };
  return {begin, begun: () => begun, settled: () => settled};
}

it('loads each thumbnail once and tells when it has loaded or failed', async () => {
  const keepThumbnails = await keeper();
  const loads = counter();
  keepThumbnails(['a.jpg', 'b.jpg'], loads.begin);
  const [a, b] = made();
  expect(sources(made())).toEqual(['a.jpg', 'b.jpg']);
  expect(loads.begun()).toBe(2);
  a?.dispatchEvent(new Event('load'));
  b?.dispatchEvent(new Event('error'));
  expect(loads.settled()).toBe(2);
});

it('keeps a loaded thumbnail ready, and tries a failed one again', async () => {
  const keepThumbnails = await keeper();
  keepThumbnails(['a.jpg', 'b.jpg']);
  const [a, b] = made();
  a?.dispatchEvent(new Event('load'));
  b?.dispatchEvent(new Event('error'));
  const from = listen.mock.contexts.length;
  const again = counter();
  keepThumbnails(['a.jpg', 'b.jpg'], again.begin);
  expect(sources(made(from))).toEqual(['b.jpg']);
  expect(again.begun()).toBe(1);
});

it('keeps the 300 newest thumbnails, and lets the oldest go first', async () => {
  const keepThumbnails = await keeper();
  keepThumbnails(Array.from({length: 300}, (_, index) => `${index}.jpg`));
  keepThumbnails(['0.jpg']);
  keepThumbnails(['new.jpg']);
  const from = listen.mock.contexts.length;
  keepThumbnails(['0.jpg', 'new.jpg', '1.jpg']);
  expect(sources(made(from))).toEqual(['1.jpg']);
});
