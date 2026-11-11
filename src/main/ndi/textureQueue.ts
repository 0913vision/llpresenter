import type {Rectangle} from 'electron';

export const NDI_FRAME_WIDTH = 1920;
export const NDI_FRAME_HEIGHT = 1080;
const MAX_PENDING_TEXTURES = 2;

export interface TextureFrame {
  readonly texture: {release: () => void};
  readonly dirty: Rectangle;
}

interface TextureQueueCallbacks<T extends TextureFrame> {
  readonly send: (frame: T) => void;
  readonly invalidate: () => void;
  readonly overflow: () => void;
  readonly recovered: () => void;
}

/** Retains a bounded sequence until each GPU copy is acknowledged. */
export class TextureQueue<T extends TextureFrame> {
  private running: T | null = null;
  private readonly pending: T[] = [];
  private refresh = false;

  constructor(private readonly callbacks: TextureQueueCallbacks<T>) {}

  get busy(): boolean {
    return this.running !== null;
  }

  push(frame: T): void {
    if (this.refresh && !this.running && this.pending.length === 0) {
      const {dirty} = frame;
      if (
        dirty.x !== 0 ||
        dirty.y !== 0 ||
        dirty.width !== NDI_FRAME_WIDTH ||
        dirty.height !== NDI_FRAME_HEIGHT
      ) {
        frame.texture.release();
        this.callbacks.invalidate();
        return;
      }
      this.refresh = false;
      this.callbacks.recovered();
    }
    if (!this.running) {
      this.dispatch(frame);
    } else if (this.pending.length < MAX_PENDING_TEXTURES && !this.refresh) {
      this.pending.push(frame);
    } else {
      frame.texture.release();
      if (!this.refresh) {
        this.refresh = true;
        this.callbacks.overflow();
      }
    }
  }

  acknowledge(): boolean {
    if (!this.running) return false;
    this.running.texture.release();
    this.running = null;
    const next = this.pending.shift();
    if (next) this.dispatch(next);
    else if (this.refresh) this.callbacks.invalidate();
    return true;
  }

  /** Releases pending textures; the caller owns the returned in-flight texture. */
  clear(): T | null {
    for (const frame of this.pending.splice(0)) frame.texture.release();
    const outstanding = this.running;
    this.running = null;
    this.refresh = false;
    return outstanding;
  }

  private dispatch(frame: T): void {
    this.running = frame;
    this.callbacks.send(frame);
  }
}
