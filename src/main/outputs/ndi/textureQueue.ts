import type {Rectangle} from 'electron';
import {unionDirty} from './rect';

export const NDI_FRAME_WIDTH = 1920;
export const NDI_FRAME_HEIGHT = 1080;
const MAX_PENDING_TEXTURES = 2;

export interface TextureFrame {
  readonly texture: {release: () => void};
  readonly dirty: Rectangle;
}

interface TextureQueueCallbacks<T extends TextureFrame> {
  readonly send: (frame: T) => void;
}

/** Retains a bounded sequence until each GPU copy is acknowledged. */
export class TextureQueue<T extends TextureFrame> {
  private running: T | null = null;
  private readonly pending: T[] = [];

  constructor(private readonly callbacks: TextureQueueCallbacks<T>) {}

  get busy(): boolean {
    return this.running !== null;
  }

  push(frame: T): void {
    if (!this.running) {
      this.dispatch(frame);
    } else if (this.pending.length < MAX_PENDING_TEXTURES) {
      this.pending.push(frame);
    } else {
      let dirty = frame.dirty;
      for (const skipped of this.pending.splice(0)) {
        dirty = unionDirty(dirty, skipped.dirty);
        skipped.texture.release();
      }
      this.pending.push({...frame, dirty});
    }
  }

  acknowledge(): boolean {
    if (!this.running) return false;
    this.running.texture.release();
    this.running = null;
    const next = this.pending.shift();
    if (next) this.dispatch(next);
    return true;
  }

  /** Releases pending textures; the caller owns the returned in-flight texture. */
  clear(): T | null {
    for (const frame of this.pending.splice(0)) frame.texture.release();
    const outstanding = this.running;
    this.running = null;
    return outstanding;
  }

  private dispatch(frame: T): void {
    this.running = frame;
    this.callbacks.send(frame);
  }
}
