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

/** The background media. It refers to the media library by id only. */
export interface MediaLayer {
  readonly mediaId: string;
  readonly loop: boolean;
}

/** The slide on output: a service item, its position in the arrangement, and what to draw. */
export interface SlideLayer {
  readonly itemId: string;
  readonly position: number;
  readonly label: string | null;
  readonly lines: readonly string[];
}

export interface PropLayer {
  readonly propId: string;
}

export interface AudioLayer {
  readonly mediaId: string;
}

export interface MessageLayer {
  readonly messageId: string;
  readonly text: string;
}

export interface NoticeLayer {
  readonly noticeId: string;
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
  /** Increases by one on every change. Windows drop states older than the one they have. */
  readonly version: number;
  readonly layers: LiveLayers;
  /** Output on or off per screen id. A missing screen is off. */
  readonly outputs: Readonly<Record<string, boolean>>;
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
  return {version: 0, layers: emptyLayers(), outputs: {}};
}

export function hasAnyLayer(layers: LiveLayers): boolean {
  return layerKinds.some(kind => layers[kind] !== null);
}
