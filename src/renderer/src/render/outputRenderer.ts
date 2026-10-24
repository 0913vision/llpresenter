import type {LiveLayers} from '@shared/live';
import {BackgroundLayerView} from './backgroundLayer';
import {classes} from './classes';
import {scaleFor, type LyricStyle} from './lyricStyle';
import {SlideLayerView} from './slideLayer';

export interface OutputRendererOptions {
  readonly lyricStyle: LyricStyle;
  /** The URL that plays a library media file. */
  readonly mediaUrl: (mediaId: string) => string;
  /** Receives drawing errors, which never reach the other layers. */
  readonly onError: (message: string, error: unknown) => void;
}

// NOTE(0913vision): The layers from the bottom up, as in "Layers and stacking
// order" in docs/spec/03-output.md.
const LAYER_ORDER = ['background', 'lyrics'] as const;

type LayerName = (typeof LAYER_ORDER)[number];

function createLayerBox(root: HTMLElement, name: LayerName): HTMLElement {
  // NOTE(0913vision): The z-index makes each layer box its own stacking
  // context, so nothing inside a layer, such as a video's z-index, can rise
  // above a higher layer.
  const box = document.createElement('div');
  box.className = classes.layer;
  box.style.zIndex = String(LAYER_ORDER.indexOf(name));
  box.dataset['layer'] = name;
  root.append(box);
  return box;
}

/**
 * Draws one screen's layers from the live state, bottom up: the background
 * media, then the lyrics. A layer that fails to draw keeps its last picture,
 * and the other layers still draw.
 */
export class OutputRenderer {
  private readonly root = document.createElement('div');
  private readonly background: BackgroundLayerView;
  private readonly slide: SlideLayerView;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    parent: HTMLElement,
    private readonly options: OutputRendererOptions,
  ) {
    this.root.className = classes.root;
    this.background = new BackgroundLayerView(
      createLayerBox(this.root, 'background'),
      options,
    );
    this.slide = new SlideLayerView(
      createLayerBox(this.root, 'lyrics'),
      options.lyricStyle,
    );
    parent.append(this.root);
    this.resizeObserver = new ResizeObserver(() => this.rescale());
    this.resizeObserver.observe(this.root);
    this.rescale();
  }

  render(layers: LiveLayers): void {
    this.draw('background', () => this.background.show(layers.media));
    this.draw('lyrics', () => this.slide.show(layers.slide));
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.background.dispose();
    this.slide.dispose();
    this.root.remove();
  }

  private draw(layer: string, drawLayer: () => void): void {
    try {
      drawLayer();
    } catch (error) {
      this.options.onError(`could not draw the ${layer} layer`, error);
    }
  }

  private rescale(): void {
    const {clientWidth, clientHeight} = this.root;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.draw('lyrics', () =>
      this.slide.rescale(scaleFor(clientWidth, clientHeight)),
    );
  }
}
