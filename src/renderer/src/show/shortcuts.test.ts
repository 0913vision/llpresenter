import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as showState from '@renderer/state/show';
import {handleSlideKey} from './shortcuts';

function press(
  key: string,
  options: KeyboardEventInit = {},
  target: Element = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  Object.defineProperty(event, 'target', {value: target});
  handleSlideKey(event);
  return event;
}

beforeEach(() => {
  vi.spyOn(showState, 'outputNext').mockImplementation(() => undefined);
  vi.spyOn(showState, 'outputPrevious').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('handleSlideKey', () => {
  it('outputs the next 장 with the right arrow and Space', () => {
    expect(press('ArrowRight').defaultPrevented).toBe(true);
    press(' ');
    expect(showState.outputNext).toHaveBeenCalledTimes(2);
  });

  it('outputs the previous 장 with the left arrow', () => {
    press('ArrowLeft');
    expect(showState.outputPrevious).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    press('a');
    press('ArrowUp');
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
  });

  it('ignores keys with a modifier', () => {
    press('ArrowRight', {ctrlKey: true});
    press('ArrowRight', {shiftKey: true});
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('leaves keys to a text field', () => {
    const field = document.body.appendChild(document.createElement('input'));
    const event = press(' ', {}, field);
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves keys to the 장 grid', () => {
    const grid = document.body.appendChild(document.createElement('div'));
    grid.setAttribute('data-slide-grid', '');
    const tile = grid.appendChild(document.createElement('button'));
    press('ArrowRight', {}, tile);
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('ignores an event that is already handled', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      cancelable: true,
    });
    event.preventDefault();
    handleSlideKey(event);
    expect(showState.outputNext).not.toHaveBeenCalled();
  });
});
