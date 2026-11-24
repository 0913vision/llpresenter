import type {LayerKind, LiveLayers} from '@core/schema/live/live';
import {liveDrawing} from './theme/drawing';
import {ThemeView} from './theme/themeView';
import {classes} from './classes';
import {ClearFades} from './clearFades';
import type {
  LayerDefinition,
  RenderLayer,
  RenderLayerOptions,
  RenderFrame,
  RenderScreen,
} from './layer';
import {renderLayers} from './layers/renderLayers';
import {scaleFor} from '@core/overlays';
import {PICTURE_TRANSFORM, pictureTransform} from './pictureCorrection';

const CHROMA_BACKGROUND = 'var(--chroma)';

export type OutputRendererOptions = RenderLayerOptions;

interface ActiveLayer {
  readonly kind: string;
  readonly view: RenderLayer;
  readonly box: HTMLElement;
  readonly fades: LayerKind | undefined;
}

/** The slide is under every layer. */
const THEME_ORDER = 1;

function createLayerBox(
  root: HTMLElement,
  layer: LayerDefinition,
  order: number,
): HTMLElement {
  // NOTE(0913vision): Each layer box has its own stacking context, so a video's
  // z-index cannot rise above a higher layer.
  const box = document.createElement('div');
  box.className = classes.layer;
  box.style.zIndex = String(order);
  box.dataset['layer'] = layer.kind;
  root.append(box);
  return box;
}

/**
 * Draws the slide and the layers over it, back to front, keeping a failed layer isolated. The
 * screen's picture correction moves and scales every layer, while the empty
 * area keeps the screen's empty color.
 */
export class OutputRenderer {
  private readonly root = document.createElement('div');
  private readonly blackScreen = document.createElement('div');
  private readonly layers: readonly ActiveLayer[];
  private readonly themeBox: HTMLElement;
  private readonly theme: ThemeView;
  private readonly resizeObserver: ResizeObserver | null;
  private disposed = false;
  private background: string | null = null;
  private screen: RenderScreen | undefined;
  private transform: string | null = null;
  private scale = 1;
  private testPattern = false;
  private initialLayers: LiveLayers | null = null;
  private readonly clearFades = new ClearFades();
  private readonly onFonts = (): void => this.theme.refit();
  private fadeFrame: number | null = null;
  private latest: {layers: LiveLayers; frame: RenderFrame} | null = null;

  constructor(
    parent: HTMLElement,
    private readonly options: OutputRendererOptions,
  ) {
    this.root.className = classes.root;
    if (options.transparent) this.setBackground('transparent');
    this.themeBox = document.createElement('div');
    this.themeBox.className = classes.layer;
    this.themeBox.dataset['layer'] = 'theme';
    this.themeBox.style.zIndex = String(THEME_ORDER);
    this.root.append(this.themeBox);
    this.theme = new ThemeView(this.themeBox, {
      mediaUrl: options.mediaUrl,
      previewMedia: options.previewMedia,
      onError: options.onError,
      ...(options.mode === undefined ? {} : {mode: options.mode}),
      ...(options.transparent === undefined
        ? {}
        : {transparent: options.transparent}),
    });
    document.fonts.addEventListener('loadingdone', this.onFonts);
    this.layers = renderLayers.flatMap((layer, index) =>
      this.createLayer(layer, THEME_ORDER + 1 + index),
    );
    Object.assign(this.blackScreen.style, {
      position: 'absolute',
      inset: '0',
      background: '#000000',
      zIndex: '1000',
      pointerEvents: 'none',
    });
    this.blackScreen.dataset['blackScreen'] = '';
    this.blackScreen.hidden = true;
    this.root.append(this.blackScreen);
    parent.append(this.root);
    this.resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(entries => {
            const entry = entries[0];
            if (entry === undefined) return;
            this.rescale(
              Math.round(entry.contentRect.width),
              Math.round(entry.contentRect.height),
            );
          });
    this.resizeObserver?.observe(this.root);
    this.rescale();
  }

  render(layers: LiveLayers, frame?: RenderFrame): void {
    if (this.disposed) return;
    frame = {
      ...frame,
      transitions:
        frame?.transitions ??
        (this.initialLayers !== null && layers !== this.initialLayers),
    };
    this.initialLayers ??= layers;
    this.latest = {layers, frame};
    this.draw(layers, frame);
  }

  private draw(layers: LiveLayers, frame: RenderFrame): void {
    if (this.fadeFrame !== null) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = null;
    const now =
      frame.timers?.now().timer ?? performance.timeOrigin + performance.now();
    const fading = this.clearFades.resolve(
      layers,
      frame.clearEffects ?? [],
      now,
    );
    frame = {
      ...frame,
      clearOpacity: fading.opacity,
      propOpacity: fading.propOpacity,
    };
    this.testPattern = frame.testPattern === true;
    this.blackScreen.hidden = frame.blackScreen !== true;
    this.root.classList.toggle(classes.instant, frame.transitions === false);
    const emptyColor =
      frame.screen?.emptyColor ??
      (frame.screen?.method === 'capture' ? CHROMA_BACKGROUND : null);
    this.setBackground(
      this.options.transparent === true ? 'transparent' : emptyColor,
    );
    this.setScreen(frame.screen);
    this.attempt('theme', 'draw', () => {
      const cleared =
        frame.item?.contentCleared === true &&
        fading.layers.slide === null &&
        fading.layers.media === null;
      this.theme.setOpacity({
        slide: fading.opacity.slide ?? 1,
        media: fading.opacity.media ?? 1,
      });
      if (fading.opacity.media !== undefined) this.theme.hold();
      this.theme.draw(
        cleared
          ? null
          : liveDrawing(
              fading.layers,
              frame,
              this.options.transparent === true,
            ),
      );
    });
    for (const layer of this.layers) {
      const opacity =
        layer.fades === undefined ? undefined : fading.opacity[layer.fades];
      layer.box.style.opacity = opacity === undefined ? '' : String(opacity);
      this.attempt(layer.kind, 'draw', () =>
        layer.view.render(fading.layers, frame),
      );
    }
    if (fading.active) {
      this.fadeFrame = requestAnimationFrame(() => {
        this.fadeFrame = null;
        const latest = this.latest;
        if (!this.disposed && latest !== null) {
          this.attempt('clear fade', 'draw', () =>
            this.draw(latest.layers, latest.frame),
          );
        }
      });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    if (this.fadeFrame !== null) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = null;
    this.clearFades.dispose();
    document.fonts.removeEventListener('loadingdone', this.onFonts);
    this.attempt('theme', 'dispose', () => this.theme.dispose());
    this.latest = null;
    for (const {kind, view} of this.layers) {
      this.attempt(kind, 'dispose', () => view.dispose());
    }
    this.root.remove();
  }

  ready(): boolean {
    return (
      !this.disposed &&
      (this.testPattern ||
        (this.theme.ready() &&
          this.layers.every(({view}) => view.ready?.() ?? true)))
    );
  }

  /** Only identifiers and kinds are returned for diagnostics. */
  unreadyElements(): ReadonlyArray<{kind: string; id: string | null}> {
    if (this.disposed || this.testPattern) return [];
    return [
      ...(this.theme.ready() ? [] : [{kind: 'theme', id: null}]),
      ...this.layers.flatMap(({kind, view}) =>
        view.ready?.() === false ? [{kind, id: null}] : [],
      ),
    ];
  }

  /** The single full-screen surface used for picture transitions. */
  transitionSurface(): HTMLElement {
    return this.root;
  }

  /** Keep the current composition in place while a new slide is revealed. */
  freeze(): void {
    if (this.fadeFrame !== null) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = null;
    this.theme.hold();
    const animations =
      typeof this.root.getAnimations === 'function'
        ? this.root.getAnimations({subtree: true})
        : [];
    for (const animation of animations) {
      animation.pause();
    }
    for (const video of this.root.querySelectorAll('video')) video.pause();
  }

  /** Whether frame-rate sampling has moving content to measure. */
  moving(): boolean {
    const animations =
      typeof this.root.getAnimations === 'function'
        ? this.root.getAnimations({subtree: true})
        : [];
    return (
      !this.disposed &&
      (this.fadeFrame !== null ||
        animations.some(
          animation => animation.playState === 'running' || animation.pending,
        ) ||
        Array.from(this.root.querySelectorAll('video')).some(
          video => !video.paused && !video.ended,
        ))
    );
  }

  private setBackground(background: string | null): void {
    if (background === this.background) return;
    this.background = background;
    if (background === null) {
      this.root.style.removeProperty('--output-background');
    } else this.root.style.setProperty('--output-background', background);
  }

  private setScreen(screen: RenderScreen | undefined): void {
    if (screen === this.screen) return;
    this.screen = screen;
    this.applyCorrection();
  }

  private applyCorrection(): void {
    const correction = this.screen?.correction;
    const transform =
      correction === undefined
        ? null
        : pictureTransform(correction, this.scale);
    if (transform === this.transform) return;
    this.transform = transform;
    if (transform === null) {
      this.root.style.removeProperty(PICTURE_TRANSFORM);
    } else this.root.style.setProperty(PICTURE_TRANSFORM, transform);
  }

  private createLayer(layer: LayerDefinition, order: number): ActiveLayer[] {
    const box = createLayerBox(this.root, layer, order);
    try {
      return [
        {
          kind: layer.kind,
          view: layer.create(box, this.options),
          box,
          fades: layer.fades,
        },
      ];
    } catch (error) {
      box.remove();
      const message = `could not create the ${layer.kind} layer`;
      this.options.onDrawFailure?.(message, error);
      this.options.onError(message, error);
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
      const message = `could not ${operation} the ${kind} layer`;
      if (operation === 'draw') this.options.onDrawFailure?.(message, error);
      this.options.onError(message, error);
    }
  }

  private rescale(
    clientWidth = this.root.clientWidth,
    clientHeight = this.root.clientHeight,
  ): void {
    if (clientWidth === 0 || clientHeight === 0) return;
    const scale = scaleFor(clientWidth, clientHeight);
    this.theme.rescale(clientWidth, clientHeight);
    this.scale = scale;
    for (const {kind, view} of this.layers) {
      this.attempt(kind, 'draw', () => view.rescale?.(scale));
    }
    this.applyCorrection();
  }
}
