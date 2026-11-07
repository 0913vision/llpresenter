import {useEffect, useState} from 'react';
import {createScreenId} from '@core/schema/ids';
import {sendLive} from '@renderer/session/live';
import {menuAvailability, type MenuItem} from '@renderer/ui/menuModel';

/** Why 테스트 화면 is off: no screen has its output on. */
export const NO_SCREEN_ON = '출력 꺼짐';

/**
 * 보기 › 테스트 화면: shows the 테스트 패턴 on every screen whose output is on,
 * or takes it off them all (spec 06, "Output preview"). A screen whose output
 * is off is left alone: it has no window to show it on, and its pattern goes
 * off with its output. The row is checked while every screen that is on shows
 * the pattern.
 */
export function testPatternRow({
  screens: saved,
  outputs,
  patterns,
}: {
  /** The saved screens; only they can show the pattern. */
  readonly screens: ReadonlyArray<{readonly id: string}>;
  readonly outputs: Readonly<Record<string, boolean>>;
  readonly patterns: readonly string[] | undefined;
}): MenuItem {
  const screens = saved
    .filter(screen => outputs[screen.id] === true)
    .map(screen => screen.id);
  const checked =
    screens.length > 0 && screens.every(id => patterns?.includes(id) === true);
  return {
    kind: 'item',
    id: 'test-patterns',
    label: '테스트 화면',
    check: 'checkbox',
    checked,
    ...menuAvailability(screens.length === 0 ? NO_SCREEN_ON : undefined),
    onSelect: () => {
      for (const screenId of screens) {
        sendLive({
          type: 'screen.testPattern.set',
          screenId: createScreenId(screenId),
          on: !checked,
        });
      }
    },
  };
}

/**
 * Whether the control window is full screen now: read once, then followed as
 * main reports it entering and leaving full screen.
 */
export function useFullScreen(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let current = true;
    api.window.fullScreen().then(
      value => {
        if (current) setOn(value);
      },
      (cause: unknown) => console.error('Could not read full screen', cause),
    );
    const stop = api.window.onFullScreen(setOn);
    return () => {
      current = false;
      stop();
    };
  }, []);
  return on;
}

/**
 * 보기 › 전체 화면 (the Full Screen row of the PP View menu): a check row that puts the control
 * window in or out of full screen. It has no key (spec 10 names none).
 */
export function fullScreenRow(on: boolean): MenuItem {
  return {
    kind: 'item',
    id: 'full-screen',
    label: '전체 화면',
    check: 'checkbox',
    checked: on,
    onSelect: () => window.llp?.window.control('toggle-full-screen'),
  };
}
