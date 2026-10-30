import type {ScreenId} from '@core/schema/ids';
import type {Screen} from '@core/schema/screens';
import {MAX_TARGET_SCREENS} from '@core/schema/overlayState';
import type {MonitorInfo} from '@core/schema/monitors';
import {assignScreenMonitor} from './assignScreenMonitor';

export interface NewScreen {
  readonly id: ScreenId;
  readonly kind: Screen['kind'];
  readonly method: Exclude<Screen['method'], 'ndi'>;
  readonly monitor?: MonitorInfo;
}

/** Appends a screen and assigns its chosen monitor in the same settings revision. */
export function addScreen(
  screens: readonly Screen[],
  input: NewScreen,
  observedScreens?: readonly Screen[],
): readonly Screen[] {
  if (screens.length >= MAX_TARGET_SCREENS) {
    throw new Error('화면은 200개까지 추가할 수 있음');
  }
  if (screens.some(screen => screen.id === input.id)) {
    throw new Error('화면 추가 실패');
  }
  const base = input.kind === 'audience' ? '새 청중 화면' : '새 무대 화면';
  const names = new Set(screens.map(screen => screen.name.trim()));
  let name = base;
  for (let suffix = 2; names.has(name); suffix++) name = `${base} (${suffix})`;
  const next = [
    ...screens,
    {
      id: input.id,
      kind: input.kind,
      method: input.method,
      name,
      alwaysOnTop: false,
      ...(input.method === 'capture'
        ? {resolution: {width: 1920, height: 1080}}
        : {}),
    },
  ];
  return input.monitor === undefined
    ? next
    : assignScreenMonitor({
        screens: next,
        screenId: input.id,
        monitor: input.monitor,
        observedScreens,
      });
}
