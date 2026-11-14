import type {SlideTransition} from '@core/schema/slideTransition';
import {SlideAnimation} from '../rendering/slideAnimation';

/** Holds a captured output frame while the next complete picture is prepared. */
export class SnapshotTransition {
  private readonly animation = new SlideAnimation(true);
  private image: HTMLImageElement | null = null;
  private frame: number | null = null;
  private generation = 0;

  constructor(
    private readonly parent: HTMLElement,
    private readonly surface: HTMLElement,
  ) {}

  async prepare(data: string): Promise<boolean> {
    const generation = ++this.generation;
    const image = document.createElement('img');
    image.src = data;
    try {
      await image.decode();
    } catch {
      return false;
    }
    if (generation !== this.generation) return false;
    this.animation.cancel();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.image?.remove();
    Object.assign(image.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '2',
    });
    image.alt = '';
    this.parent.append(image);
    this.image = image;
    return true;
  }

  play(effect: SlideTransition, ready: () => boolean, done: () => void): void {
    const generation = this.generation;
    const check = (): void => {
      if (generation !== this.generation || this.image === null) return;
      if (!ready()) {
        this.frame = requestAnimationFrame(check);
        return;
      }
      this.frame = null;
      const image = this.image;
      image.style.zIndex = '0';
      this.surface.style.zIndex = '1';
      this.animation.play(image, this.surface, effect);
      const finished = this.animation.finished();
      if (finished === null) {
        this.frame = requestAnimationFrame(() => {
          this.clear();
          done();
        });
      } else {
        void finished.then(
          () => {
            if (generation === this.generation) {
              this.clear();
              done();
            }
          },
          () => undefined,
        );
      }
    };
    this.frame = requestAnimationFrame(check);
  }

  clear(): void {
    this.generation += 1;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.animation.cancel();
    this.image?.remove();
    this.image = null;
    this.surface.style.zIndex = '';
    this.surface.style.transition = '';
    this.surface.style.opacity = '';
  }
}
