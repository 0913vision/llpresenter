import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import * as showState from '@renderer/features/presentation/state/show';
import {modalStack} from '@renderer/ui/modalStack';
import {useShowKeys} from './shortcuts';

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

it('does not dispatch a source key from a text field, composition or modal', () => {
  const {output} = setup();
  expect(press(screen.getByRole('textbox')).defaultPrevented).toBe(false);
  expect(press(window, {isComposing: true}).defaultPrevented).toBe(false);
  const modal = document.createElement('div');
  document.body.append(modal);
  const close = modalStack.push(modal);
  expect(press().defaultPrevented).toBe(false);
  close();
  modal.remove();
  expect(output).not.toHaveBeenCalled();
  expect(press().defaultPrevented).toBe(true);
  expect(output).toHaveBeenCalledOnce();
});

it('does not dispatch during a thresholded pointer drag and resumes afterward', () => {
  const {output} = setup();
  fireEvent.pointerDown(window, {
    pointerId: 1,
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  fireEvent.pointerMove(window, {pointerId: 1, clientX: 30, clientY: 10});
  expect(press().defaultPrevented).toBe(false);
  expect(output).not.toHaveBeenCalled();
  fireEvent.pointerUp(window, {pointerId: 1});
  expect(press().defaultPrevented).toBe(true);
  expect(output).toHaveBeenCalledOnce();
});
