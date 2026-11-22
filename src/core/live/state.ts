import type {SlideTexts, VerseReference} from '../schema/slide';
import type {SlideBackground} from '../schema/theme';
import type {SlideTransition} from '../schema/slideTransition';
import type {AutoValues, SlideContent} from '../theme/content';
import type {ActiveMessage, ActiveProp} from '../schema/overlayState';
import type {MacroId, ScreenId, SlideId, ThemeId, TimerId} from '../schema/ids';
import type {TimerRuns} from '../schema/timerState';
import type {AudioPlayback} from '../schema/audioState';
import type {ClearTarget} from './commands';
import type {ClearEffect} from '../schema/clearFade';
import type {OutputMediaProperties} from '../schema/outputMedia';
import type {
  LiveItem,
  LiveItemKind,
  LiveThemeMode,
  LiveThemeOutput,
} from '../schema/liveTheme';
export type {ActiveMessage, ActiveProp} from '../schema/overlayState';

/** Layer kinds from bottom to top. */
export const layerKinds = [
  'media',
  'slide',
  'prop',
  'audio',
  'message',
] as const;

export type LayerKind = (typeof layerKinds)[number];

/** A background media choice. It refers to the media library by id only. */
export interface MediaChoice {
  readonly mediaId: string;
  readonly loop: boolean;
  readonly itemId?: string;
  readonly title?: string;
  /** The operator put it on output, apart from any slide. */
  readonly chosen?: true;
}

/** The background media on output. */
export interface MediaLayer extends MediaChoice {
  readonly properties?: OutputMediaProperties;
  readonly positionSeconds?: number;
  /**
   * When this background started, in milliseconds since the epoch on the main
   * process clock, so a window that opens or reloads later joins it at the
   * same point.
   */
  readonly startedAt: number;
}

/** The texts of the other slides that share the size of this one. */
export type SlidePeer = Pick<SlideContent, 'texts' | 'auto' | 'continued'>;

/** The slide on output: what it shows, and where it is in its item. */
export interface SlideLayer {
  readonly itemId: string;
  readonly slideId: SlideId;
  readonly position: number;
  readonly sequenceLength?: number;
  /** What the item is, for an item outside the open 예배 순서. */
  readonly kind?: LiveItemKind;
  readonly title?: string;
  readonly theme: ThemeId;
  readonly texts: SlideTexts;
  readonly auto: AutoValues;
  readonly continued?: true;
  /** The slide's own background; the theme's when absent. */
  readonly background?: SlideBackground;
  /** What the slide after this one lets it show; null for nothing. */
  readonly next: string | null;
  /** The slides of the item whose texts are sized together with this one. */
  readonly peers?: readonly SlidePeer[];
  readonly verse?: VerseReference;
  readonly transition?: SlideTransition;
  /** Wall-clock start of the currently running audience slide transition. */
  readonly transitionStartedAt?: number;
  /** Effect of the slide being left by an explicit previous command. */
  readonly reverseTransition?: SlideTransition | null;
}

export interface PropLayer {
  readonly propId: string;
  readonly items?: readonly ActiveProp[];
}

export interface AudioLayer {
  readonly properties?: OutputMediaProperties;
  readonly mediaId: string;
  readonly playback?: AudioPlayback;
}

export interface MessageLayer {
  readonly messageId: string;
  readonly text: string;
  readonly items?: readonly ActiveMessage[];
}

export interface LiveLayers {
  readonly media: MediaLayer | null;
  readonly slide: SlideLayer | null;
  readonly prop: PropLayer | null;
  readonly audio: AudioLayer | null;
  readonly message: MessageLayer | null;
}

/** The live output state. The main process owns it; windows receive copies. */
export interface LiveState {
  readonly item?: LiveItem | null;
  /** Whether the item button can restore its session-only stopped item. */
  readonly canRestoreItem?: boolean;
  readonly themeMode?: LiveThemeMode;
  readonly themeOutput?: LiveThemeOutput;
  /** The most recently run macro in this session, if one has run. */
  readonly lastMacroId?: MacroId;
  /** Last allocated audio track version, retained across clears and batches. */
  readonly audioTrackVersion?: number;
  /** The audio layer's live volume, from 0 to 100; absent means 100. */
  readonly audioVolume?: number;
  /** The 무대 메시지 sent from 진행 도구; absent or null means none. */
  readonly stageMessage?: string | null;
  /** Increases by one on every change. Windows drop states older than the one they have. */
  readonly version: number;
  /** Asks the control renderer to commit this frame before releasing it to outputs. */
  readonly waitingForControl?: true;
  readonly blackScreen?: boolean;
  readonly layers: LiveLayers;
  /** Output on or off per screen id. A missing screen is off. */
  readonly outputs: Readonly<Record<string, boolean>>;
  /** Whether the last clear can be undone, so the 되돌리기 button can dim. */
  readonly canUndo: boolean;
  /** Clear keys with captured content available for a second press to restore. */
  readonly clearToggles?: readonly ClearTarget[];
  readonly clearEffects?: readonly ClearEffect[];
  /** The started 타이머 by id; clears never touch them. Absent means none started. */
  readonly timers?: TimerRuns;
  /** The screens showing the 테스트 패턴; clears never touch it. Absent means none. */
  readonly testPatterns?: readonly ScreenId[];
  /** The 타이머 the 무대 화면's 타이머 element shows. Absent means none. */
  readonly stageTimerId?: TimerId;
}

export function emptyLayers(): LiveLayers {
  return {
    media: null,
    slide: null,
    prop: null,
    audio: null,
    message: null,
  };
}

export function emptyLiveState(): LiveState {
  return {version: 0, layers: emptyLayers(), outputs: {}, canUndo: false};
}

/** Whether any screen's output is on, which pauses backups and updates. */
export function isAnyOutputOn({outputs}: LiveState): boolean {
  return Object.values(outputs).some(on => on);
}

export function hasAnyLayer(layers: LiveLayers): boolean {
  return layerKinds.some(kind => layers[kind] !== null);
}
