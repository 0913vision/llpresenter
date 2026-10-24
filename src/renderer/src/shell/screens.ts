// TODO(0913vision): Read the screen list from the screen settings once the
// output work package stores them.

export interface ScreenSummary {
  readonly id: string;
  readonly icon: string;
  readonly toolbarLabel: string;
  readonly statusLabel: string;
  readonly target: string;
}

export const defaultScreens: readonly ScreenSummary[] = [
  {
    id: 'main',
    icon: 'mplay',
    toolbarLabel: '본 화면',
    statusLabel: '본 화면',
    target: '모니터 2',
  },
  {
    id: 'stage',
    icon: 'mplay',
    toolbarLabel: '무대',
    statusLabel: '무대 화면',
    target: '모니터 3',
  },
  {
    id: 'broadcast',
    icon: 'capture',
    toolbarLabel: '방송 자막',
    statusLabel: '방송 자막',
    target: 'NDI',
  },
];
