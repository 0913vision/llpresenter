import {useEffect, useState} from 'react';
import type {MenuItem} from '@renderer/ui/menus/menuModel';

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
