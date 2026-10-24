/** The floating layers, each a single container at the end of `body`. */
export type LayerName = 'popover' | 'tooltip' | 'dialog';

const LAYER_ATTRIBUTE = 'data-llp-layer';

/**
 * Returns the container of a floating layer, creating it on first use. The
 * containers live as long as the window, one per layer.
 */
export function layerContainer(name: LayerName): HTMLElement {
  const existing = document.querySelector<HTMLElement>(
    `[${LAYER_ATTRIBUTE}="${name}"]`,
  );
  if (existing !== null) return existing;
  const container = document.createElement('div');
  container.setAttribute(LAYER_ATTRIBUTE, name);
  document.body.append(container);
  return container;
}

/** Whether an element is one of the floating layer containers. */
export function isLayerContainer(element: Element): boolean {
  return element.hasAttribute(LAYER_ATTRIBUTE);
}
