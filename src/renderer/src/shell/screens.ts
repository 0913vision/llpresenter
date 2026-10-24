// TODO(0913vision): Read the look names from the current Look, and the screen list from the screen settings once the
// output work package stores them.

export interface ScreenSummary {
  readonly id: string;
  readonly icon: string;
  readonly toolbarLabel: string;
  readonly statusLabel: string;
  readonly target: string;
  /** The name of the lyric style or stage layout now in use on the screen. */
  readonly lookName: string;
  /** Draws the empty picture green (the 방송 자막). */
  readonly chroma: boolean;
}

export const defaultScreens: readonly ScreenSummary[] = [
  {
    id: 'main',
    icon: 'mplay',
    toolbarLabel: '본 화면',
    statusLabel: '본 화면',
    target: '모니터 2',
    lookName: '기본',
    chroma: false,
  },
  {
    id: 'stage',
    icon: 'mplay',
    toolbarLabel: '무대',
    statusLabel: '무대 화면',
    target: '모니터 3',
    lookName: '현재와 다음',
    chroma: false,
  },
  {
    id: 'broadcast',
    icon: 'capture',
    toolbarLabel: '방송 자막',
    statusLabel: '방송 자막',
    target: 'NDI',
    lookName: '하단 자막',
    chroma: true,
  },
];
