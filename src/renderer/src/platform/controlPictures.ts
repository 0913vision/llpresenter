import {openPictureCopies} from './pictureCopies';
import type {LlpApi} from '@contracts/ipc/api';
import {
  mediaUrl,
  mediaIdFromUrl,
  thumbnailIdFromUrl,
} from '@contracts/ipc/mediaUrls';
import {pictureBucket} from '@core/media/pictureSize';
import type {MediaDocument} from '@core/schema/mediaEdit';

const REFRESH_MS = 5000;

interface PictureTarget {
  readonly element: HTMLElement;
  source: string;
  applied: string;
  key: string;
  generation: number;
}

/** Sizes only control-window pictures, including imperative preview layers and portals. */
export function startControlPictures(api: LlpApi | undefined): () => void {
  const copies = openPictureCopies();
  const targets = new Map<HTMLElement, PictureTarget>();
  let pictures = new Set<string>();
  let revision = -1;
  let frame = 0;
  let stopped = false;

  function sourceOf(element: HTMLElement): string {
    if (element instanceof HTMLImageElement) return element.src;
    const applied = element.style.backgroundImage;
    const previous = targets.get(element);
    if (previous?.applied === applied) return previous.source;
    return /^url\(["']?(llp-media:[^"')]+)["']?\)$/.exec(applied)?.[1] ?? '';
  }

  function update(element: HTMLElement): void {
    const original = sourceOf(element);
    const id = mediaIdFromUrl(original) ?? thumbnailIdFromUrl(original);
    const previous = targets.get(element);
    if (id === null) {
      if (previous !== undefined) {
        previous.generation++;
        targets.delete(element);
        if (element instanceof HTMLImageElement) {
          element.removeAttribute('srcset');
        }
      }
      return;
    }
    const target = previous ?? {
      element,
      source: original,
      applied: '',
      key: '',
      generation: 0,
    };
    if (target.source !== original) {
      target.source = original;
      target.key = '';
      target.generation++;
      if (element instanceof HTMLImageElement) {
        element.removeAttribute('srcset');
      }
    }
    targets.set(element, target);
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const style = getComputedStyle(element);
    const value = {
      source: pictures.has(id) ? mediaUrl(id) : original,
      thumbnail: pictures.has(id) && thumbnailIdFromUrl(original) !== null,
      width: pictureBucket(rect.width, window.devicePixelRatio),
      height: pictureBucket(rect.height, window.devicePixelRatio),
      fit:
        element instanceof HTMLImageElement
          ? style.objectFit
          : style.backgroundSize === 'cover'
            ? 'cover'
            : 'contain',
    };
    const key = JSON.stringify(value);
    if (target.key === key) return;
    if (target.key !== '' && element instanceof HTMLImageElement) {
      element.removeAttribute('srcset');
    }
    target.key = key;
    const generation = ++target.generation;
    copies.get(value).then(
      url => {
        if (
          stopped ||
          generation !== target.generation ||
          !element.isConnected ||
          url === ''
        ) {
          return;
        }
        if (element instanceof HTMLImageElement) {
          if (element.srcset !== `${url} 1x`) element.srcset = `${url} 1x`;
        } else {
          if (element.style.backgroundImage !== `url("${url}")`) {
            element.style.backgroundImage = `url("${url}")`;
          }
          target.applied = element.style.backgroundImage;
        }
      },
      (error: unknown) => {
        if (stopped || generation !== target.generation) return;
        console.warn('Could not size control picture', error);
        if (element instanceof HTMLImageElement) {
          element.removeAttribute('srcset');
        }
      },
    );
  }

  const resize = new ResizeObserver(() => schedule());
  const observed = new Set<Element>();
  function scan(): void {
    frame = 0;
    if (stopped) return;
    for (const [element, target] of targets) {
      if (!element.isConnected) {
        target.generation++;
        targets.delete(element);
      }
    }
    const observing = new Set<Element>([document.body]);
    const elements = new Set<HTMLElement>(targets.keys());
    for (const element of document.querySelectorAll(
      'img, [style*="llp-media:"]',
    )) {
      if (element instanceof HTMLElement) elements.add(element);
    }
    for (const element of elements) {
      update(element);
      observing.add(element.closest('svg') ?? element);
    }
    for (const element of observed) {
      if (!observing.has(element)) {
        resize.unobserve(element);
        observed.delete(element);
      }
    }
    for (const element of observing) {
      if (!observed.has(element)) {
        resize.observe(element);
        observed.add(element);
      }
    }
  }
  function schedule(): void {
    if (!stopped && frame === 0) {
      frame = requestIdleCallback(scan, {timeout: 100});
    }
  }
  function refresh(): void {
    for (const target of targets.values()) target.key = '';
    schedule();
  }
  function accept(document: MediaDocument): void {
    if (stopped || document.revision <= revision) return;
    revision = document.revision;
    pictures = new Set(
      document.value.items
        .filter(item => item.kind === 'image')
        .map(item => item.id),
    );
    refresh();
  }
  const stopMedia = api?.media.subscribe(accept);
  const stopStamps = api?.media.subscribeStamps(refresh);
  api?.media
    .get()
    .then(accept, (error: unknown) =>
      console.warn('Could not read preview media', error),
    );
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'style', 'class', 'hidden'],
  });
  const interval = window.setInterval(refresh, REFRESH_MS);
  const restoreSource = (event: Event): void => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.srcset === '') return;
    const target = targets.get(image);
    if (target === undefined) return;
    target.generation++;
    target.key = '';
    image.removeAttribute('srcset');
  };
  document.body.addEventListener('error', restoreSource, true);
  window.addEventListener('resize', refresh);
  schedule();
  return () => {
    stopped = true;
    cancelIdleCallback(frame);
    clearInterval(interval);
    window.removeEventListener('resize', refresh);
    document.body.removeEventListener('error', restoreSource, true);
    stopMedia?.();
    stopStamps?.();
    mutations.disconnect();
    resize.disconnect();
    copies.dispose();
    for (const {element, source} of targets.values()) {
      if (element instanceof HTMLImageElement) {
        element.removeAttribute('srcset');
      } else element.style.backgroundImage = `url("${source}")`;
    }
    targets.clear();
  };
}
