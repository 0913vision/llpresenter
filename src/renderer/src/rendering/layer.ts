import type {LayerKind, LiveLayers} from '@core/schema/live/live';
import type {ClearEffect} from '@core/schema/live/clearFade';
import type {RenderMode} from './backgroundLayer';
import type {TextStyle} from '@core/overlays';
import type {RenderTimers} from './timerTokens';
import type {ScreenId, TimerId} from '@core/schema/common/ids';
import type {Screen} from '@core/schema/screens/screens';
import type {LiveItem, LiveThemeOutput} from '@core/schema/live/liveTheme';
import type {FontCatalog} from '@core/schema/screens/fontCatalog';
import type {MessageBand} from '@core/screens';
import type {PreviewMediaSource} from './previewMedia';

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
  /** Configured output dimensions, when known. */
  readonly pictureSize?: {readonly width: number; readonly height: number};
  /** Absent draws the picture over the whole screen. */
  readonly correction?: PictureCorrection;
}

export interface RenderFrame {
  readonly stageTimerId?: TimerId;
  readonly theme?: LiveThemeOutput;
  readonly item?: LiveItem | null;
  readonly fonts?: FontCatalog;
  readonly clearEffects?: readonly ClearEffect[];
  readonly clearOpacity?: Readonly<Partial<Record<LayerKind, number>>>;
  readonly propOpacity?: ReadonlyMap<string, number>;
  readonly transitions?: boolean;
  /** Prepares a paused frame without audio, animation or clock updates. */
  readonly standby?: boolean;
  readonly screen?: RenderScreen;
  /** How this screen draws a 메시지; absent draws the 기본 style. */
  readonly messageStyle?: TextStyle;
  /** Set when the screen's style is the built-in 기본 band; absent draws `messageStyle` as text. */
  readonly messageBand?: MessageBand;
  readonly stageMessage?: string | null;
  /** What `{timer:<id>}` tokens in 소품 text read; absent reads as no 타이머. */
  readonly timers?: RenderTimers;
  /** Covers the picture with the 테스트 패턴. */
  readonly testPattern?: boolean;
  readonly blackScreen?: boolean;
}

export interface RenderLayerOptions {
  /** Draw the foreground without the screen's background, for NDI. */
  readonly transparent?: boolean;
  /** The original library URL, also used for image elements in previews. */
  readonly mediaUrl: (mediaId: string) => string;
  readonly previewMedia?: PreviewMediaSource | undefined;
  /** Receives drawing errors, which never reach the other layers. */
  readonly onError: (message: string, error: unknown) => void;
  /** Signals an incomplete draw to a caller that captures the resulting frame. */
  readonly onDrawFailure?: (message: string, error: unknown) => void;
  /** A preview draws still pictures without video elements; `output` when absent. */
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
  /** The live layer whose clear fade dims this layer; absent never dims it. */
  readonly fades?: LayerKind;
  readonly create: (
    parent: HTMLElement,
    options: RenderLayerOptions,
  ) => RenderLayer;
}
