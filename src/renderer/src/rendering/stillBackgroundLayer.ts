import type {MediaLayer} from '@core/live/state';
import {mediaObjectFit} from '@core/media/objectFit';
import {loadBackgroundImage} from './backgroundImage';
import type {BackgroundLayerOptions} from './backgroundLayer';
import type {PreviewMediaSource} from './previewMedia';
import {classes} from './classes';
import {OUTPUT_TRANSITIONS} from './transitions';

/** A control preview owns only cached pictures, never a media element. */
export class StillBackgroundLayerView {
  private readonly element = document.createElement('div');
  private readonly images = [
    document.createElement('img'),
    document.createElement('img'),
  ] as const;
  private readonly stops: [(() => void) | null, (() => void) | null] = [
    null,
    null,
  ];
  private front: 0 | 1 = 0;
  private current: string | null = null;
  private media: MediaLayer | null = null;
  private generation = 0;
  private pending = false;
  private dissolveMs: number = OUTPUT_TRANSITIONS.backgroundMs;
  private finish: ReturnType<typeof setTimeout> | null = null;
  private onError: BackgroundLayerOptions['onError'];
  private readonly url: BackgroundLayerOptions['mediaUrl'];
  private readonly previewMedia: PreviewMediaSource | undefined;

  constructor(parent: HTMLElement, options: BackgroundLayerOptions) {
    this.onError = options.onError;
    this.url = options.mediaUrl;
    this.previewMedia = options.previewMedia;
    this.element.className = classes.layer;
    for (const image of this.images) {
      image.alt = '';
      image.className = classes.image;
    }
    this.element.append(...this.images);
    parent.append(this.element);
  }

  setOnError(onError: BackgroundLayerOptions['onError']): void {
    this.onError = onError;
  }

  setDissolveMs(ms: number): void {
    this.dissolveMs = ms;
  }

  show(media: MediaLayer | null, transitions = true): void {
    this.media = media;
    for (const image of this.images) {
      image.style.objectFit = mediaObjectFit(media?.properties?.fit ?? 'fill');
    }
    if ((media?.mediaId ?? null) === this.current) return;
    this.current = media?.mediaId ?? null;
    const generation = ++this.generation;
    this.cancelFinish();
    const to = this.front === 0 ? 1 : 0;
    this.clear(to);
    this.images[this.front].classList.remove(classes.dissolving);
    if (media === null) {
      this.clear(this.front);
      this.pending = false;
      return;
    }
    this.pending = true;
    const image = this.images[to];
    const fail = (): void => {
      if (generation !== this.generation) return;
      this.pending = false;
      this.clear(to);
      this.clear(this.front);
      this.onError('could not load a preview picture', {
        mediaId: media.mediaId,
      });
    };
    const load = (src: string): void => {
      if (generation !== this.generation) return;
      this.stops[to] = loadBackgroundImage(image, {
        src,
        onReady: () => {
          this.pending = false;
          const outgoing = this.front;
          this.front = to;
          image.style.zIndex = '1';
          this.images[outgoing].style.zIndex = '0';
          const dissolve = transitions && this.dissolveMs > 0;
          this.element.style.setProperty(
            '--background-dissolve',
            `${this.dissolveMs}ms`,
          );
          image.classList.toggle(classes.dissolving, dissolve);
          getComputedStyle(image).getPropertyValue('opacity');
          image.classList.add(classes.shown);
          if (dissolve) {
            this.finish = setTimeout(() => {
              this.finish = null;
              this.clear(outgoing);
            }, this.dissolveMs);
          } else this.clear(outgoing);
        },
        onError: fail,
      });
    };
    try {
      const preview = this.previewMedia;
      if (preview === undefined) load(this.url(media.mediaId));
      else preview.url(media.mediaId).then(load).catch(fail);
    } catch {
      fail();
    }
  }

  ready(): boolean {
    return !this.pending;
  }

  remaining(): number | undefined {
    return this.media === null
      ? undefined
      : this.previewMedia?.remaining(this.media);
  }

  /** Leaves a cached still behind while the incoming composition takes ownership. */
  moveTo(parent: HTMLElement): boolean {
    const image = this.images[this.front];
    if (image.hasAttribute('src')) {
      const snapshot = image.cloneNode();
      if (!(snapshot instanceof HTMLImageElement)) return false;
      snapshot.dataset['mediaSnapshot'] = '';
      snapshot.classList.remove(classes.dissolving);
      const outgoing = this.element.parentElement;
      outgoing?.querySelector('[data-media-snapshot]')?.remove();
      outgoing?.append(snapshot);
    }
    parent.append(this.element);
    return true;
  }

  dispose(): void {
    this.generation++;
    this.cancelFinish();
    this.clear(0);
    this.clear(1);
    this.element.remove();
  }

  private cancelFinish(): void {
    if (this.finish !== null) clearTimeout(this.finish);
    this.finish = null;
  }

  private clear(index: 0 | 1): void {
    this.stops[index]?.();
    this.stops[index] = null;
    this.images[index].removeAttribute('src');
    this.images[index].classList.remove(classes.shown, classes.dissolving);
  }
}
