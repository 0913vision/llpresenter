import {
  publishNativeMirror,
  setNativeMirror,
  type Pump,
} from '../previews/nativeMirror';

/** The bytes of one preview frame: 640 by 360 RGBA. */
const MIRROR_FRAME_BYTES = 640 * 360 * 4;

/**
 * The preview of a shown presenter in the control window. The presenter
 * sends small frames while the preview asks for them, one at a time.
 */
export class PresenterMirror {
  private readonly pump: Pump;

  constructor(
    /** The screen it previews now. */
    private readonly screenId: () => string,
    post: (message: Record<string, unknown>) => void,
  ) {
    this.pump = {
      enable: enabled => post({type: 'mirror', enabled}),
      ack: () => post({type: 'mirror-ack'}),
    };
  }

  /** The presenter shows: its frames may go to the preview. */
  start(): void {
    setNativeMirror(this.screenId(), this.pump);
  }

  /** The presenter is hidden or gone: the preview has nothing to show. */
  stop(): void {
    setNativeMirror(this.screenId(), null);
  }

  /** A preview frame of the presenter; one of another size is passed over. */
  frame(frame: unknown): void {
    if (frame instanceof Uint8Array && frame.length === MIRROR_FRAME_BYTES) {
      publishNativeMirror(this.screenId(), frame);
    } else this.pump.ack();
  }
}
