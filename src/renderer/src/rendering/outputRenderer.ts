import {emptyLayers, type LiveLayers} from '@core/live/state';
import {ThemeCompositionView} from './themeComposition';
import {classes} from './classes';
import {ClearFades} from './clearFades';
import type {
  RegisteredLayer,
  RenderLayer,
  RenderLayerOptions,
  RenderFrame,
  RenderScreen,
} from './layer';
import {renderLayers} from './layers';
import {scaleFor} from '@core/looks/lyricStyle';
import {PICTURE_TRANSFORM, pictureTransform} from './pictureCorrection';
import {
  showsLayer,
  type LookLayer,
  type ScreenAppearance,
} from '@core/looks/screenLook';

const CHROMA_BACKGROUND = 'var(--chroma)';
const THEME_LAYER_ORDERS: Readonly<Record<string, number>> = {
  notice: 2,
  prop: 3,
  message: 4,
};
const LEGACY_CONTENT_LAYERS = new Set([
  'background',
  'lyrics',
  'stage',
  'stage-message',
]);
const noContent = emptyLayers();

export type OutputRendererOptions = RenderLayerOptions;

interface ActiveLayer {
  readonly kind: string;
  readonly view: RenderLayer;
  readonly box: HTMLElement;
  readonly look: LookLayer | undefined;
  hidden: boolean;
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

/**
 * Draws registered layers back to front, keeping a failed layer isolated. The
 * screen's picture correction moves and scales every layer, while the empty
 * area keeps the screen's empty color.
 */
export class OutputRenderer {
  private readonly root = document.createElement('div');
  private readonly layers: readonly ActiveLayer[];
  private theme: ThemeCompositionView | null = null;
  private readonly resizeObserver: ResizeObserver;
  private disposed = false;
  private background: string | null = null;
  private screen: RenderScreen | undefined;
  private transform: string | null = null;
  private scale = 1;
  private testPattern = false;
  private initialLayers: LiveLayers | null = null;
  private readonly clearFades = new ClearFades();
  private fadeFrame: number | null = null;
  private latest: {layers: LiveLayers; frame: RenderFrame} | null = null;

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
    const look = frame.look ?? null;
    this.testPattern = frame.testPattern === true;
    this.root.classList.toggle(classes.instant, frame.transitions === false);
    this.setBackground(
      (frame.theme === undefined
        ? look?.background
        : (frame.theme.layout.background ?? frame.theme.emptyColor)) ??
        frame.screen?.emptyColor ??
        (frame.screen?.method === 'capture' ? CHROMA_BACKGROUND : null),
    );
    this.setScreen(frame.screen);
    this.attempt('theme', 'draw', () => {
      if (frame.theme !== undefined) {
        this.theme ??= new ThemeCompositionView(this.root, this.options);
      }
      this.theme?.render(fading.layers, frame);
    });
    const {stage: _stage, clearOpacity: _clearOpacity, ...legacyFrame} = frame;
    for (const layer of this.layers) {
      const themed = frame.theme !== undefined;
      const legacy = LEGACY_CONTENT_LAYERS.has(layer.kind);
      this.setHidden(layer, themed ? null : look, themed && legacy);
      const order =
        renderLayers.find(entry => entry.kind === layer.kind)?.order ?? 0;
      layer.box.style.zIndex = String(
        themed ? (THEME_LAYER_ORDERS[layer.kind] ?? order) : order,
      );
      const opacity =
        layer.look === undefined ||
        layer.look === 'clock' ||
        layer.look === 'stageMessage'
          ? undefined
          : fading.opacity[layer.look];
      layer.box.style.opacity = layer.hidden
        ? '0'
        : opacity === undefined
          ? ''
          : String(opacity);
      this.attempt(layer.kind, 'draw', () =>
        layer.view.render(
          themed && legacy ? noContent : fading.layers,
          themed && legacy ? legacyFrame : frame,
        ),
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
    this.resizeObserver.disconnect();
    if (this.fadeFrame !== null) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = null;
    this.clearFades.dispose();
    this.attempt('theme', 'dispose', () => this.theme?.dispose());
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
        ((this.theme?.ready() ?? true) &&
          this.layers.every(
            ({hidden, view}) => hidden || (view.ready?.() ?? true),
          )))
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

  // NOTE(0913vision): A layer the Look turns off keeps drawing under opacity
  // 0, so its content, layout, and video playback stay ready for the next
  // Look, and a descendant's own visibility can't show it.
  private setHidden(
    layer: ActiveLayer,
    look: ScreenAppearance | null,
    suppress = false,
  ): void {
    const hidden =
      suppress || (layer.look !== undefined && !showsLayer(look, layer.look));
    if (hidden === layer.hidden) return;
    layer.hidden = hidden;
    layer.box.classList.toggle(classes.hidden, hidden);
  }

  private createLayer(layer: RegisteredLayer): ActiveLayer[] {
    const box = createLayerBox(this.root, layer);
    try {
      return [
        {
          kind: layer.kind,
          view: layer.create(box, this.options),
          box,
          look: layer.look,
          hidden: false,
        },
      ];
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
    this.theme?.rescale();
    this.scale = scale;
    for (const {kind, view} of this.layers) {
      this.attempt(kind, 'draw', () => view.rescale?.(scale));
    }
    this.applyCorrection();
  }
}
