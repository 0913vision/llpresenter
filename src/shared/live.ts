import type {
  ActiveMessage,
  ActiveProp,
  NoticePlayback,
} from './schema/overlayState';
import type {LookId, ScreenId, StageLayoutId, TimerId} from './schema/ids';
import type {TimerRuns} from './schema/timerState';
import type {AudioPlayback} from './schema/audioState';
import type {ClearTarget} from './commands';
import type {ClearEffect} from './schema/clearFade';
export type {
  ActiveMessage,
  ActiveProp,
  NoticePlayback,
} from './schema/overlayState';

/** Layer kinds from bottom to top. Each screen's Look decides which ones it shows. */
export const layerKinds = [
  'media',
  'slide',
  'prop',
  'audio',
  'message',
  'notice',
] as const;

export type LayerKind = (typeof layerKinds)[number];

/** A background media choice. It refers to the media library by id only. */
export interface MediaChoice {
  readonly mediaId: string;
  readonly loop: boolean;
}

/** The background media on output. */
export interface MediaLayer extends MediaChoice {
  /**
   * When this background started, in milliseconds since the epoch on the main
   * process clock, so a window that opens or reloads later joins it at the
   * same point.
   */
  readonly startedAt: number;
}

/** The 장 after the live one in the item's sequence, for the 무대 화면. */
export interface NextSlide {
  readonly label: string | null;
  readonly lines: readonly string[];
}

/** The slide on output: a service item, its position in the arrangement, and what to draw. */
export interface SlideLayer {
  readonly itemId: string;
  readonly position: number;
  readonly label: string | null;
  readonly lines: readonly string[];
  /** The next 장 when the sender knows one; absent after the item's last. */
  readonly next?: NextSlide;
}

export interface PropLayer {
  readonly propId: string;
  readonly items?: readonly ActiveProp[];
}

export interface AudioLayer {
  readonly mediaId: string;
  readonly playback?: AudioPlayback;
}

export interface MessageLayer {
  readonly messageId: string;
  readonly text: string;
  readonly items?: readonly ActiveMessage[];
}

export interface NoticeLayer {
  readonly noticeId: string;
  readonly playback?: NoticePlayback;
}

export interface LiveLayers {
  readonly media: MediaLayer | null;
  readonly slide: SlideLayer | null;
  readonly prop: PropLayer | null;
  readonly audio: AudioLayer | null;
  readonly message: MessageLayer | null;
  readonly notice: NoticeLayer | null;
}

/** The live output state. The main process owns it; windows receive copies. */
export interface LiveState {
  /** Last allocated audio track version, retained across clears and batches. */
  readonly audioTrackVersion?: number;
  /** The audio layer's live volume, from 0 to 100; absent means 100. */
  readonly audioVolume?: number;
  /** The selected Look; absent or null uses the saved current Look. */
  readonly lookId?: LookId | null;
  readonly stageMessage?: string | null;
  /** Increases by one on every change. Windows drop states older than the one they have. */
  readonly version: number;
  readonly layers: LiveLayers;
  /** Output on or off per screen id. A missing screen is off. */
  readonly outputs: Readonly<Record<string, boolean>>;
  /** Whether the last clear can be undone, so the 되돌림 button can dim. */
  readonly canUndo: boolean;
  /** Clear keys with captured content available for a second press to restore. */
  readonly clearToggles?: readonly ClearTarget[];
  readonly clearEffects?: readonly ClearEffect[];
  /** The started 타이머 by id; clears never touch them. Absent means none started. */
  readonly timers?: TimerRuns;
  /** The screens showing the 테스트 패턴; clears never touch it. Absent means none. */
  readonly testPatterns?: readonly ScreenId[];
  /** Stage layouts chosen for this output, by stage screen, until the next Look change. */
  readonly stageLayouts?: Readonly<Record<ScreenId, StageLayoutId>>;
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
    notice: null,
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
