import type {MediaLayer} from '@core/schema/live';
import {mediaObjectFit} from '@core/media/objectFit';
import type {BackgroundLayerOptions} from './backgroundLayer';
import {classes} from './classes';

/**
 * The background of a still. An image this window has loaded is drawn in the
 * same frame as the text above it.
 */
export class StillBackgroundLayerView {
  private readonly element = document.createElement('div');
  private readonly image = document.createElement('img');
  private media: MediaLayer | null = null;
  private pending = false;

  constructor(
    parent: HTMLElement,
    private options: BackgroundLayerOptions,
  ) {
    this.element.className = classes.layer;
    this.image.className = classes.image;
    this.image.alt = '';
    this.image.decoding = 'sync';
    this.image.addEventListener('load', () => this.loaded());
    this.image.addEventListener('error', () =>
      this.failed(this.media?.mediaId ?? null),
    );
    this.element.append(this.image);
    parent.append(this.element);
  }

  setOnError(onError: BackgroundLayerOptions['onError']): void {
    this.options = {...this.options, onError};
  }

  show(media: MediaLayer | null): void {
    const previous = this.media?.mediaId;
    this.media = media;
    this.image.style.objectFit = mediaObjectFit(
      media?.properties?.fit ?? 'fill',
    );
    if (media?.mediaId === previous) return;
    if (media === null) {
      this.clear();
      return;
    }
    const {mediaId} = media;
    const {previewMedia, mediaUrl} = this.options;
    const known =
      previewMedia === undefined
        ? mediaUrl(mediaId)
        : previewMedia.peek(mediaId);
    if (known !== undefined) {
      this.draw(known);
      return;
    }
    this.clear();
    this.pending = true;
    previewMedia?.url(mediaId).then(
      url => {
        if (this.media?.mediaId === mediaId) this.draw(url);
      },
      () => this.failed(mediaId),
    );
  }

  ready(): boolean {
    return !this.pending;
  }

  remaining(): number | undefined {
    return this.media === null
      ? undefined
      : this.options.previewMedia?.remaining(this.media);
  }

  /** A still draws its own background; it never takes another page's. */
  moveTo(): boolean {
    return false;
  }

  dispose(): void {
    this.media = null;
    this.clear();
    this.element.remove();
  }

  private draw(url: string): void {
    if (this.image.getAttribute('src') !== url) this.image.src = url;
    if (this.image.complete) this.loaded();
    else this.pending = true;
  }

  private loaded(): void {
    this.pending = false;
    this.image.classList.add(classes.shown);
  }

  private failed(mediaId: string | null): void {
    if (mediaId === null || this.media?.mediaId !== mediaId) return;
    this.clear();
    this.options.onError('could not load a preview picture', {mediaId});
  }

  private clear(): void {
    this.pending = false;
    this.image.removeAttribute('src');
    this.image.classList.remove(classes.shown);
  }
}
