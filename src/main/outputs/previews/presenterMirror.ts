/**
 * The frame producer of a shown presenter. `enable` turns frames on or off, and
 * `ack` tells it that the last frame was taken.
 */
export interface Pump {
  enable(enabled: boolean): void;
  ack(): void;
}

/** Removes only the producer that owns this registration. */
export function clearPresenterMirror(screenId: string, pump: Pump): void {
  if (pumps.get(screenId) === pump) setPresenterMirror(screenId, null);
}

type Sink = (frame: Uint8Array | null) => void;
const pumps = new Map<string, Pump>();
const sinks = new Map<
  string,
  {frame: Sink; availability: ((available: boolean) => void) | undefined}
>();

/** The shown presenter's bounded frame producer for one output. */
export function setPresenterMirror(screenId: string, pump: Pump | null): void {
  const previous = pumps.get(screenId);
  if (previous === pump) return;
  if (previous !== undefined) {
    previous.enable(false);
    pumps.delete(screenId);
    const sink = sinks.get(screenId);
    sink?.availability?.(false);
    sink?.frame(null);
  }
  if (pump !== null) {
    pumps.set(screenId, pump);
    const sink = sinks.get(screenId);
    if (sink !== undefined) {
      sink.availability?.(true);
      pump.enable(true);
    }
  }
}

/** Only the control window can subscribe; it must acknowledge every frame. */
export function subscribePresenterMirror(
  screenId: string,
  sink: Sink,
  availability?: (available: boolean) => void,
): () => void {
  const subscriber = {frame: sink, availability};
  sinks.set(screenId, subscriber);
  const pump = pumps.get(screenId);
  availability?.(pump !== undefined);
  pump?.enable(true);
  return () => {
    if (sinks.get(screenId) !== subscriber) return;
    sinks.delete(screenId);
    pumps.get(screenId)?.enable(false);
  };
}

/**
 * Hands a frame to the control window's subscriber. With no subscriber it
 * acknowledges the frame so the producer goes on.
 */
export function publishPresenterMirror(
  screenId: string,
  frame: Uint8Array,
): void {
  const sink = sinks.get(screenId);
  if (sink === undefined) pumps.get(screenId)?.ack();
  else sink.frame(frame);
}

/** Whether a presenter produces frames for this screen. */
export function hasPresenterMirror(screenId: string): boolean {
  return pumps.has(screenId);
}

/**
 * Tells the producer of this screen that the control window took its last
 * frame.
 */
export function ackPresenterMirror(screenId: string): void {
  pumps.get(screenId)?.ack();
}
