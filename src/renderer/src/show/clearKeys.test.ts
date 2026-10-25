import {renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as clearState from '@renderer/state/clear';
import {handleClearKey, useClearKeys} from './clearKeys';

function press(
  code: string,
  options: KeyboardEventInit = {},
  target: Element = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code,
    key: 'Unidentified',
    bubbles: true,
    cancelable: true,
    ...options,
  });
  Object.defineProperty(event, 'target', {value: target});
  handleClearKey(event);
  return event;
}

function appendTo(tag: string, attributes: Record<string, string> = {}) {
  const element = document.body.appendChild(document.createElement(tag));
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

beforeEach(() => {
  vi.spyOn(clearState, 'clearLayer').mockImplementation(() => undefined);
  vi.spyOn(clearState, 'undoClear').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('handleClearKey F1 to F7', () => {
  it.each([
    ['F1', 'all'],
    ['F2', 'slide'],
    ['F3', 'media'],
    ['F4', 'prop'],
    ['F5', 'audio'],
    ['F6', 'message'],
    ['F7', 'notice'],
  ])('clears with %s the layer %s and swallows the key', (code, target) => {
    expect(press(code).defaultPrevented).toBe(true);
    expect(clearState.clearLayer).toHaveBeenCalledWith(target);
  });

  it('clear in a text field and during an IME composition', () => {
    press('F2', {}, appendTo('input'));
    press('F3', {isComposing: true}, appendTo('textarea'));
    expect(clearState.clearLayer).toHaveBeenCalledTimes(2);
  });

  it('leave a field that records a shortcut alone', () => {
    const recorder = appendTo('div', {'data-shortcut-recording': ''});
    const inner = recorder.appendChild(document.createElement('button'));
    const event = press('F2', {}, inner);
    expect(clearState.clearLayer).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('run once for a held key and swallow the repeats', () => {
    press('F2');
    const repeated = press('F2', {repeat: true});
    expect(clearState.clearLayer).toHaveBeenCalledTimes(1);
    expect(repeated.defaultPrevented).toBe(true);
  });

  it('are ignored with a modifier and for other keys', () => {
    press('F2', {ctrlKey: true});
    press('F2', {shiftKey: true});
    press('F8');
    press('KeyA');
    expect(clearState.clearLayer).not.toHaveBeenCalled();
  });

  it('are ignored for an event that is already handled', () => {
    const event = new KeyboardEvent('keydown', {code: 'F2', cancelable: true});
    event.preventDefault();
    handleClearKey(event);
    expect(clearState.clearLayer).not.toHaveBeenCalled();
  });
});

describe('handleClearKey Ctrl Z', () => {
  it('does not undo a clear and leaves the key to others', () => {
    const event = press('KeyZ', {ctrlKey: true});
    expect(clearState.undoClear).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('useClearKeys', () => {
  function pressOn(
    target: Element,
    code: string,
    options: KeyboardEventInit = {},
  ): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    target.dispatchEvent(event);
    return event;
  }

  it('clears with F2 even when a handler below it consumes the key', () => {
    renderHook(() => useClearKeys());
    const field = appendTo('input');
    field.addEventListener('keydown', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    pressOn(field, 'F2');
    expect(clearState.clearLayer).toHaveBeenCalledWith('slide');
  });

  it('stops listening when it unmounts', () => {
    const {unmount} = renderHook(() => useClearKeys());
    unmount();
    pressOn(document.body, 'F2');
    expect(clearState.clearLayer).not.toHaveBeenCalled();
  });
});
