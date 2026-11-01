import {act, cleanup, render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import * as showState from '@renderer/session/show';
import {useShowKeys} from '@renderer/features/presentation/shortcuts';

function Host() {
  useShowKeys();
  return <input aria-label="lyrics" />;
}

function press(target: EventTarget = window, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'ㅊ',
    code: 'KeyC',
    bubbles: true,
    cancelable: true,
    ...options,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function setup() {
  vi.spyOn(showState, 'hasSlideHotKey').mockImplementation(
    code => code === 'KeyC',
  );
  const output = vi.spyOn(showState, 'outputHotKey').mockReturnValue(true);
  return {output, view: render(<Host />)};
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('dispatches one physical source key per press and releases it on unmount', () => {
  const {output, view} = setup();
  expect(press().defaultPrevented).toBe(true);
  expect(press(window, {repeat: true}).defaultPrevented).toBe(true);
  expect(output).toHaveBeenCalledExactlyOnceWith('KeyC');
  view.unmount();
  expect(press().defaultPrevented).toBe(false);
  expect(output).toHaveBeenCalledOnce();
});
