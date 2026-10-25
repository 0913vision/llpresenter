// TODO(0913vision): Read the screen list from the screen settings once the
// output work package stores them (M3), and show each screen's Look or stage
// layout name under the large preview again (`look` of the ui `PreviewFrame`).

export interface ScreenSummary {
  readonly id: string;
  readonly icon: string;
  readonly toolbarLabel: string;
  readonly statusLabel: string;
  readonly target: string;
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
    chroma: false,
  },
  {
    id: 'stage',
    icon: 'mplay',
    toolbarLabel: '무대',
    statusLabel: '무대 화면',
    target: '모니터 3',
    chroma: false,
  },
  {
    id: 'broadcast',
    icon: 'capture',
    toolbarLabel: '방송 자막',
    statusLabel: '방송 자막',
    target: 'NDI',
    chroma: true,
  },
];
