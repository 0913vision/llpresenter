import type {LayerKind, LiveLayers} from '@core/live/state';
import type {ClearEffect} from '@core/schema/clearFade';
import type {RenderMode} from './backgroundLayer';
import type {TextStyle} from '@core/themes/textStyle';
import type {RenderTimers} from './timerTokens';
import type {ScreenId, TimerId} from '@core/schema/ids';
import type {Screen} from '@core/schema/screens';
import type {
  LiveThemeItem,
  LiveThemeOutput,
  ThemeComposition,
} from '@core/schema/liveTheme';
import type {FontCatalog} from '@core/schema/fontCatalog';
import type {MessageBand} from '@core/screens/messageStyle';
import type {TransitionTimes} from '@core/output/transitions';

export interface ThemeFrame extends ThemeComposition {
  readonly themeId: LiveThemeOutput['themeId'];
  readonly revision: number;
  readonly missing: readonly string[];
  readonly item: LiveThemeItem | null;
}

/** 가장자리 여백 and 위치 미세 조정 of a screen (docs/spec/03-output.md). */
export interface PictureCorrection {
  /** The percent of the width and of the height left empty on each side. */
  readonly edgeMargin: number;
  /** How far the scaled picture moves right and down, in reference px (1080 lines). */
  readonly offset: {readonly x: number; readonly y: number};
}

export interface RenderScreen {
  readonly id: ScreenId;
  /** The saved screen name; absent for a picture of no saved screen. */
  readonly name?: string;
  readonly kind: Screen['kind'];
  readonly messageStyleId?: string;
  readonly method?: Screen['method'];
  readonly emptyColor?: string;
  /** Absent draws the picture over the whole screen. */
  readonly correction?: PictureCorrection;
}

export interface RenderFrame {
  readonly stageTimerId?: TimerId;
  readonly theme?: ThemeFrame;
  readonly fonts?: FontCatalog;
  readonly clearEffects?: readonly ClearEffect[];
  readonly clearOpacity?: Readonly<Partial<Record<LayerKind, number>>>;
  readonly propOpacity?: ReadonlyMap<string, number>;
  readonly transitions?: boolean;
  readonly screen?: RenderScreen;
  /** How this screen draws a 메시지; absent draws the 기본 style. */
  readonly messageStyle?: TextStyle;
  /** Set when the screen's style is the built-in 기본 band; absent draws `messageStyle` as text. */
  readonly messageBand?: MessageBand;
  /** The 전환 times of 환경설정; absent keeps the default times. */
  readonly transitionTimes?: TransitionTimes;
  readonly stageMessage?: string | null;
  /** What `{timer:<id>}` tokens in 소품 text read; absent reads as no 타이머. */
  readonly timers?: RenderTimers;
  /** Covers the picture with the 테스트 패턴. */
  readonly testPattern?: boolean;
}

export interface RenderLayerOptions {
  /** Shows fixed-size verse text and its line budget in the split preview. */
  readonly biblePreview?: {
    readonly elementId: string;
    readonly maxLines: number;
  };
  readonly textStyle: TextStyle;
  /** The URL that plays a library media file. */
  readonly mediaUrl: (mediaId: string) => string;
  /** Receives drawing errors, which never reach the other layers. */
  readonly onError: (message: string, error: unknown) => void;
  /** A preview keeps one looping video playing; `output` when absent. */
  readonly mode?: RenderMode;
  readonly muted?: boolean;
}

/** One persistent layer instance, owned and released by its output renderer. */
export interface RenderLayer {
  ready?(): boolean;
  render(layers: LiveLayers, frame?: RenderFrame): void;
  rescale?(scale: number): void;
  dispose(): void;
}

export interface LayerDefinition {
  readonly kind: string;
  /** Back to front, matching the stacking order in the output specification. */
  readonly order: number;
  /** The live layer whose clear fade dims this layer; absent never dims it. */
  readonly fades?: LayerKind;
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
