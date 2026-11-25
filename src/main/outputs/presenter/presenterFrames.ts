/**
 * How long a frame may wait for the presenter to take it. A presenter that
 * waits longer has stopped, and the screen falls back to its output window
 * instead of staying dark while its status says it runs (church, Nov 25).
 */
export const PRESENTER_STALL_MS = 3000;

/** The part of a shared texture of the page that the presenter needs. */
export interface PageTexture {
  readonly textureInfo: {
    readonly handle: {readonly ntHandle?: Buffer | undefined};
  };
  release(): void;
}

/** A page frame as the presenter process gets it. */
export interface FrameMessage {
  readonly type: 'frame';
  readonly pid: number;
  /** The shared texture's NT handle in the page's process, in hex. */
  readonly handle: string;
  /** The id the presenter gives back as 'copied'. */
  readonly id: number;
}

/** Where the frames go, and what is told when they cannot. */
export interface PresenterFramesOptions {
  readonly post: (message: FrameMessage) => void;
  /** No frame was taken for PRESENTER_STALL_MS. */
  readonly stalled: () => void;
  /** A frame came that the presenter cannot open. */
  readonly failed: (reason: string) => void;
}

/**
 * The page frames on their way to one presenter. At most one is with the
 * presenter at a time, under an id; the presenter gives that id back as
 * 'copied' once the frame can be freed, also when it dropped the frame with a
 * window that went away. Frames painted meanwhile wait, the newest replacing
 * the one before. A frame not taken in time means the presenter has stopped.
 */
export class PresenterFrames {
  private lastId = 0;
  private sent: {
    readonly id: number;
    readonly texture: PageTexture;
  } | null = null;
  private waiting: PageTexture | null = null;
  private stall: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: PresenterFramesOptions) {}

  /** Whether no frame is with the presenter or waiting for it. */
  get idle(): boolean {
    return this.sent === null && this.waiting === null;
  }

  /**
   * A frame the page painted: it goes now when `canSend` and no other frame
   * is with the presenter, else it waits.
   */
  take(texture: PageTexture, canSend: boolean): void {
    if (canSend && this.sent === null) {
      this.send(texture);
      return;
    }
    this.waiting?.release();
    this.waiting = texture;
  }

  /**
   * Sends the waiting frame when no frame is with the presenter.
   *
   * @returns Whether the presenter has a frame now.
   */
  sendWaiting(): boolean {
    if (this.sent !== null) return true;
    const next = this.waiting;
    this.waiting = null;
    if (next === null) return false;
    this.send(next);
    return true;
  }

  /** The presenter is done with frame `id`; the waiting one goes next. */
  copied(id: unknown): void {
    const {sent} = this;
    if (sent === null || sent.id !== id) return;
    this.stopStall();
    sent.texture.release();
    this.sent = null;
    this.sendWaiting();
  }

  /** Frees every frame; the presenter is gone. */
  close(): void {
    this.stopStall();
    this.sent?.texture.release();
    this.waiting?.release();
    this.sent = null;
    this.waiting = null;
  }

  private send(texture: PageTexture): void {
    const handle = texture.textureInfo.handle.ntHandle;
    if (handle?.length !== 8) {
      texture.release();
      this.options.failed('unsupported texture handle');
      return;
    }
    this.lastId += 1;
    this.sent = {id: this.lastId, texture};
    this.options.post({
      type: 'frame',
      pid: process.pid,
      handle: handle.readBigUInt64LE(0).toString(16),
      id: this.lastId,
    });
    this.stall ??= setTimeout(() => {
      this.stall = null;
      this.options.stalled();
    }, PRESENTER_STALL_MS);
  }

  private stopStall(): void {
    if (this.stall !== null) clearTimeout(this.stall);
    this.stall = null;
  }
}
