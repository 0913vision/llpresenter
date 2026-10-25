import type {LiveLayers} from '@shared/live';
import {classes} from './classes';
import type {RegisteredLayer, RenderLayer, RenderLayerOptions} from './layer';
import {renderLayers} from './layers';
import {scaleFor} from './lyricStyle';

export type OutputRendererOptions = RenderLayerOptions;

interface ActiveLayer {
  readonly kind: string;
  readonly view: RenderLayer;
}

function createLayerBox(
  root: HTMLElement,
  layer: RegisteredLayer,
): HTMLElement {
  // NOTE(0913vision): Each layer box has its own stacking context, so a video's
  // z-index cannot rise above a higher layer.
  const box = document.createElement('div');
  box.className = classes.layer;
  box.style.zIndex = String(layer.order);
  box.dataset['layer'] = layer.kind;
  root.append(box);
  return box;
}

/** Draws registered layers back to front, keeping a failed layer isolated. */
export class OutputRenderer {
  private readonly root = document.createElement('div');
  private readonly layers: readonly ActiveLayer[];
  private readonly resizeObserver: ResizeObserver;
  private disposed = false;

  constructor(
    parent: HTMLElement,
    private readonly options: OutputRendererOptions,
  ) {
    this.root.className = classes.root;
    this.layers = renderLayers.flatMap(layer => this.createLayer(layer));
    parent.append(this.root);
    this.resizeObserver = new ResizeObserver(() => this.rescale());
    this.resizeObserver.observe(this.root);
    this.rescale();
  }

  render(layers: LiveLayers): void {
    for (const {kind, view} of this.layers) {
      this.attempt(kind, 'draw', () => view.render(layers));
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver.disconnect();
    for (const {kind, view} of this.layers) {
      this.attempt(kind, 'dispose', () => view.dispose());
    }
    this.root.remove();
  }

  private createLayer(layer: RegisteredLayer): ActiveLayer[] {
    const box = createLayerBox(this.root, layer);
    try {
      return [{kind: layer.kind, view: layer.create(box, this.options)}];
    } catch (error) {
      box.remove();
      this.options.onError(`could not create the ${layer.kind} layer`, error);
      return [];
    }
  }

  private attempt(
    kind: string,
    operation: 'draw' | 'dispose',
    action: () => void,
  ): void {
    try {
      action();
    } catch (error) {
      this.options.onError(`could not ${operation} the ${kind} layer`, error);
    }
  }

  private rescale(): void {
    const {clientWidth, clientHeight} = this.root;
    if (clientWidth === 0 || clientHeight === 0) return;
    const scale = scaleFor(clientWidth, clientHeight);
    for (const {kind, view} of this.layers) {
      this.attempt(kind, 'draw', () => view.rescale?.(scale));
    }
  }
}
