import type {LiveLayers} from '@shared/live';
import type {RenderMode} from './backgroundLayer';
import type {LyricStyle} from './lyricStyle';
import type {ScreenId} from '@shared/schema/ids';

export interface RenderScreen {
  readonly id: ScreenId;
  readonly kind: 'audience' | 'stage';
}

export interface RenderFrame {
  readonly screen?: RenderScreen;
  readonly stageMessage?: string | null;
}

export interface RenderLayerOptions {
  readonly lyricStyle: LyricStyle;
  /** The URL that plays a library media file. */
  readonly mediaUrl: (mediaId: string) => string;
  /** Receives drawing errors, which never reach the other layers. */
  readonly onError: (message: string, error: unknown) => void;
  /** A preview keeps one looping video playing; `output` when absent. */
  readonly mode?: RenderMode;
}

/** One persistent layer instance, owned and released by its output renderer. */
export interface RenderLayer {
  render(layers: LiveLayers, frame?: RenderFrame): void;
  rescale?(scale: number): void;
  dispose(): void;
}

export interface LayerDefinition {
  readonly kind: string;
  /** Back to front, matching the stacking order in the output specification. */
  readonly order: number;
  readonly create: (
    parent: HTMLElement,
    options: RenderLayerOptions,
  ) => RenderLayer;
}

const LAYER = Symbol('render layer');

export interface RegisteredLayer extends LayerDefinition {
  readonly [LAYER]: true;
}

/** Declares a layer exported by a module in `render/layers/`. */
export function defineLayer(definition: LayerDefinition): RegisteredLayer {
  return {...definition, [LAYER]: true};
}

export function isRenderLayer(value: unknown): value is RegisteredLayer {
  return typeof value === 'object' && value !== null && LAYER in value;
}
