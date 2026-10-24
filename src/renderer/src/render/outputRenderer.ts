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
    this.background = new BackgroundLayerView(this.root, options);
    this.slide = new SlideLayerView(this.root, options.lyricStyle);
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
