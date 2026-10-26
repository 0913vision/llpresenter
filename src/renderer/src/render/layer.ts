import type {LiveLayers} from '@shared/live';
import type {RenderMode} from './backgroundLayer';
import type {LyricStyle} from './lyricStyle';
import type {LookLayer, ScreenAppearance} from './screenLook';
import type {RenderTimers} from './timerTokens';
import type {ScreenId} from '@shared/schema/ids';
import type {Screen} from '@shared/schema/screens';

/** 가장자리 여백 and 위치 미세 조정 of a screen (docs/spec/03-output.md). */
export interface PictureCorrection {
  /** The percent of the width and of the height left empty on each side. */
  readonly edgeMargin: number;
  /** How far the scaled picture moves right and down, in reference px (1080 lines). */
  readonly offset: {readonly x: number; readonly y: number};
}

export interface RenderScreen {
  readonly id: ScreenId;
  readonly kind: 'audience' | 'stage';
  readonly method?: Screen['method'];
  /** Absent draws the picture over the whole screen. */
  readonly correction?: PictureCorrection;
}

export interface RenderFrame {
  readonly screen?: RenderScreen;
  readonly stageMessage?: string | null;
  /** The screen's appearance under the current Look; absent draws as before Looks. */
  readonly look?: ScreenAppearance;
  /** What `{timer:<id>}` tokens in 소품 text read; absent reads as no 타이머. */
  readonly timers?: RenderTimers;
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
  /** The Look switch that shows this layer; absent shows it on every Look. */
  readonly look?: LookLayer;
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
