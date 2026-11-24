/** The floating layers, each a single container in `body`. */
export type LayerName = 'popover' | 'tooltip' | 'dialog' | 'notification';

const LAYER_ATTRIBUTE = 'data-llp-layer';

// NOTE(0913vision): Notification cards must come before the right column in
// the Tab order, and a layer has to sit outside the app root to stay outside
// a modal's inert, so the notification layer goes first in `body`.
const layerAtStart: Readonly<Record<LayerName, boolean>> = {
  popover: false,
  tooltip: false,
  dialog: false,
  notification: true,
};

/** Returns the container of a floating layer if it was made already. */
export function findLayerContainer(name: LayerName): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${LAYER_ATTRIBUTE}="${name}"]`);
}

/**
 * Returns the container of a floating layer, creating it on first use. The
 * containers live as long as the window, one per layer.
 */
export function layerContainer(name: LayerName): HTMLElement {
  const existing = findLayerContainer(name);
  if (existing !== null) return existing;
  const container = document.createElement('div');
  container.setAttribute(LAYER_ATTRIBUTE, name);
  if (layerAtStart[name]) document.body.prepend(container);
  else document.body.append(container);
  return container;
}

/** Whether an element is one of the floating layer containers. */
export function isLayerContainer(element: Element): boolean {
  return element.hasAttribute(LAYER_ATTRIBUTE);
}
