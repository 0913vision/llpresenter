import type {SavedDisplay} from '../displays/assign';

/** 방식 (method) of a screen that has an output window. */
export type OutputMethod = 'fullscreen' | 'window';

/** 연결이 끊기면 (when disconnected): switch to a window, or turn the output off. */
export type DisconnectAction = 'window' | 'off';

/** What the output windows need to know about one screen in 화면 설정. */
export interface OutputScreen {
  readonly id: string;
  /** The window title in window mode, for example "본 화면". */
  readonly name: string;
  readonly method: OutputMethod;
  /** The monitor of a full screen output, or null while unassigned. */
  readonly display: SavedDisplay | null;
  readonly onDisconnect: DisconnectAction;
  /** 항상 위 (always on top), for full screen only. */
  readonly alwaysOnTop: boolean;
}

/** Gives the screens in 화면 설정 order. */
export interface ScreenSource {
  list(): readonly OutputScreen[];
}
