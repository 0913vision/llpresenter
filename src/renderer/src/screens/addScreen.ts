import type {ScreenId} from '@shared/schema/ids';
import type {Screen} from '@shared/schema/screens';
import {MAX_TARGET_SCREENS} from '@shared/schema/overlayState';

export interface NewScreen {
  readonly id: ScreenId;
  readonly kind: Screen['kind'];
  readonly method: Exclude<Screen['method'], 'ndi'>;
}

/** Appends an unassigned screen with an explicit off default, preserving siblings. */
export function addScreen(
  screens: readonly Screen[],
  input: NewScreen,
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
  return [
    ...screens,
    {
      ...input,
      name,
      alwaysOnTop: false,
      ...(input.method === 'capture'
        ? {resolution: {width: 1920, height: 1080}}
        : {}),
    },
  ];
}
