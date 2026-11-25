import type {OutputWindowHandle} from '../outputWindow';

/**
 * A window handle that passes every call to the handle `target` gives now, so
 * an output can swap the handle behind it (bitmap or GPU sending) and keep
 * its own only for the calls it watches.
 */
export function forwardingHandle(
  target: () => OutputWindowHandle,
): OutputWindowHandle {
  return {
    previewContents: () => target().previewContents?.() ?? null,
    configure: screen => target().configure(screen),
    prepare: (bounds, kind) => target().prepare(bounds, kind),
    requestFrame: () => target().requestFrame(),
    contentSize: () => target().contentSize(),
    setAlwaysOnTop: value => target().setAlwaysOnTop(value),
    showFullScreen: (bounds, top) => target().showFullScreen(bounds, top),
    showWindowed: (bounds, top) => target().showWindowed(bounds, top),
    showCapture: (bounds, top) => target().showCapture(bounds, top),
    prepareForMonitorRemoval: () => target().prepareForMonitorRemoval(),
    bringToFront: () => target().bringToFront(),
    bounds: () => target().bounds(),
    hide: () => target().hide(),
    reload: () => target().reload(),
    crashRenderer: () => target().crashRenderer(),
    ping: () => target().ping(),
    destroy: () => target().destroy(),
  };
}
