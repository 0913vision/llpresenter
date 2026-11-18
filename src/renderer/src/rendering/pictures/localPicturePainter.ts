import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {fontsLoading, previewReady} from '../fontsLoading';
import {OutputRenderer} from '../outputRenderer';
import {openPreviewMedia} from '../previewMedia';
import type {PictureSpec} from './pictureService';

interface ElementCanvasContext extends CanvasRenderingContext2D {
  drawElementImage(element: HTMLElement, x: number, y: number): DOMMatrix;
}

function canDrawElement(
  context: CanvasRenderingContext2D | null,
): context is ElementCanvasContext {
  return (
    context !== null &&
    'drawElementImage' in context &&
    typeof context.drawElementImage === 'function'
  );
}

const WIDTH = 1920;
const HEIGHT = 1080;

/** Keeps the edited slide's output composition in one canvas paint subtree. */
export class LocalPicturePainter {
  private readonly canvas = document.createElement('canvas');
  private readonly host = document.createElement('div');
  private readonly media = openPreviewMedia(window.llp);
  private readonly context: ElementCanvasContext | undefined;
  private renderer: OutputRenderer | undefined;
  private transparent = false;
  private failed = false;

  constructor() {
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    if ('content' in HTMLCanvasElement.prototype) {
      this.canvas.setAttribute('content', 'drawable');
      this.host.setAttribute('drawable', '');
    } else {
      this.canvas.setAttribute('layoutsubtree', '');
    }
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${WIDTH}px`,
      height: `${HEIGHT}px`,
      zIndex: '-1',
      pointerEvents: 'none',
    });
    Object.assign(this.host.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${WIDTH}px`,
      height: `${HEIGHT}px`,
    });
    this.canvas.append(this.host);
    const context = this.canvas.getContext('2d');
    if (canDrawElement(context)) {
      this.context = context;
      document.body.prepend(this.canvas);
    }
  }

  static available(): boolean {
    return (
      typeof CanvasRenderingContext2D !== 'undefined' &&
      'drawElementImage' in CanvasRenderingContext2D.prototype
    );
  }

  private draw({layers, appearance}: PictureSpec): OutputRenderer {
    const transparent = appearance.screen.method === 'ndi';
    if (
      this.failed ||
      this.renderer === undefined ||
      this.transparent !== transparent
    ) {
      this.renderer?.dispose();
      this.failed = false;
      this.renderer = new OutputRenderer(this.host, {
        transparent,
        textStyle: DEFAULT_TEXT_STYLE,
        mediaUrl,
        previewMedia: this.media,
        readableImages: true,
        mode: 'preview',
        onError: (message, error) => {
          this.failed = true;
          console.error(message, error);
        },
      });
      this.transparent = transparent;
    }
    this.host.style.background = transparent
      ? 'transparent'
      : appearance.background;
    this.renderer.render(layers, {
      screen: appearance.screen,
      theme: appearance.theme,
      transitions: false,
      standby: true,
      ...(layers.slide === null ? {} : {slide: layers.slide}),
    });
    return this.renderer;
  }

  warm(spec: PictureSpec): void {
    this.draw({...spec, layers: {...spec.layers, slide: null}});
  }

  async paint(spec: PictureSpec): Promise<HTMLCanvasElement> {
    const context = this.context;
    if (context === undefined) {
      throw new Error('The editor canvas is unavailable');
    }
    const renderer = this.draw(spec);
    return new Promise((resolve, reject) => {
      const capture = (): void => {
        if (!previewReady(renderer) || fontsLoading(document.fonts)) return;
        cleanup();
        try {
          if (this.failed) throw new Error('A source layer could not be drawn');
          context.clearRect(0, 0, WIDTH, HEIGHT);
          if (
            this.host.clientWidth !== WIDTH ||
            this.host.clientHeight !== HEIGHT
          ) {
            throw new Error('The editor picture has no output-size layout');
          }
          context.drawElementImage(this.host, 0, 0);
          const image = document.createElement('canvas');
          image.width = WIDTH;
          image.height = HEIGHT;
          const bitmap = image.getContext('2d');
          if (bitmap === null) {
            throw new Error('Could not create a slide image');
          }
          bitmap.drawImage(this.canvas, 0, 0);
          resolve(image);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      const cleanup = (): void => {
        clearTimeout(timeout);
        this.canvas.removeEventListener('paint', capture);
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('The editor canvas did not produce a frame'));
      }, OUTPUT_REVEAL_DEADLINE_MS);
      this.canvas.addEventListener('paint', capture);
    });
  }
}
