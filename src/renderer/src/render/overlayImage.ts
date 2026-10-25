import {loadBackgroundImage} from './backgroundImage';
import {classes} from './classes';

interface OverlayImageOptions {
  readonly mediaUrl: (id: string) => string;
  readonly onError: (message: string, error: unknown) => void;
}

type Slot = 0 | 1;

/** Two reusable transparent images; a decoded replacement takes over at once. */
export class OverlayImageView {
  private readonly element = document.createElement('div');
  private readonly images: readonly [HTMLImageElement, HTMLImageElement];
  private readonly stops: [(() => void) | null, (() => void) | null] = [
    null,
    null,
  ];
  private front: Slot = 0;
  private pending: Slot | null = null;
  private requested: string | null = null;
  private displayed: string | null = null;
  private generation = 0;
  private disposed = false;

  constructor(
    parent: HTMLElement,
    private readonly options: OverlayImageOptions,
  ) {
    const create = () => {
      const image = document.createElement('img');
      image.className = classes.overlayImage;
      image.alt = '';
      image.hidden = true;
      return image;
    };
    this.images = [create(), create()];
    this.element.className = classes.layer;
    this.element.append(...this.images);
    parent.append(this.element);
  }

  show(id: string | null): void {
    if (this.disposed) return;
    if (id === this.requested) return;
    this.requested = id;
    const generation = ++this.generation;
    this.cancelPending();
    if (id === null) {
      this.stop(0);
      this.stop(1);
      this.displayed = null;
      return;
    }
    if (id === this.displayed) return;
    const to: Slot = this.front === 0 ? 1 : 0;
    const image = this.images[to];
    this.pending = to;
    this.stops[to] = loadBackgroundImage(image, {
      src: this.options.mediaUrl(id),
      onReady: () => {
        image.decode().then(
          () => {
            if (generation !== this.generation || this.pending !== to) return;
            image.hidden = false;
            this.stop(this.front);
            this.front = to;
            this.pending = null;
            this.displayed = id;
          },
          (error: unknown) => this.failed(generation, error),
        );
      },
      onError: () =>
        this.failed(
          generation,
          new Error(`Could not load overlay media ${id}`),
        ),
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.cancelPending();
    this.stop(0);
    this.stop(1);
    this.element.remove();
  }

  private failed(generation: number, error: unknown): void {
    if (generation !== this.generation) return;
    this.cancelPending();
    this.options.onError('could not load an overlay image', error);
  }

  private cancelPending(): void {
    if (this.pending !== null) this.stop(this.pending);
    this.pending = null;
  }

  private stop(slot: Slot): void {
    this.stops[slot]?.();
    this.stops[slot] = null;
    this.images[slot].hidden = true;
  }
}
