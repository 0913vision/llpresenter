import {limitReason} from '@core/common/limitReason';
import type {ScreenId} from '@core/schema/ids';
import type {Screen} from '@core/schema/screens';
import {MAX_TARGET_SCREENS} from '@core/schema/overlayState';
import type {MonitorInfo} from '@core/schema/monitors';
import {defaultScreenName} from '@core/screens/screenEdits';
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
    throw new Error(limitReason('화면', MAX_TARGET_SCREENS));
  }
  if (screens.some(screen => screen.id === input.id)) {
    throw new Error('화면 추가 실패');
  }
  const name = defaultScreenName(input.kind, screens);
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
