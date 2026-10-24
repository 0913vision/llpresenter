import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as clearState from '@renderer/state/clear';
import {handleClearKey} from './clearKeys';

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

beforeEach(() => {
  vi.spyOn(clearState, 'clearLayer').mockImplementation(() => undefined);
  vi.spyOn(clearState, 'undoClear').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('handleClearKey', () => {
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

  it('clears even while a text field has focus', () => {
    const field = document.body.appendChild(document.createElement('input'));
    press('F2', {}, field);
    expect(clearState.clearLayer).toHaveBeenCalledWith('slide');
  });

  it('runs a held key once and swallows the repeats', () => {
    press('F2');
    const repeated = press('F2', {repeat: true});
    expect(clearState.clearLayer).toHaveBeenCalledTimes(1);
    expect(repeated.defaultPrevented).toBe(true);
  });

  it('ignores F keys with a modifier and other keys', () => {
    press('F2', {ctrlKey: true});
    press('F2', {shiftKey: true});
    press('F8');
    press('KeyA');
    expect(clearState.clearLayer).not.toHaveBeenCalled();
  });

  it('undoes with Ctrl Z', () => {
    expect(press('KeyZ', {ctrlKey: true}).defaultPrevented).toBe(true);
    expect(clearState.undoClear).toHaveBeenCalledTimes(1);
  });

  it('leaves Ctrl Z to a text field, where it is the edit undo', () => {
    const field = document.body.appendChild(document.createElement('textarea'));
    const event = press('KeyZ', {ctrlKey: true}, field);
    expect(clearState.undoClear).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not undo with Z alone, Ctrl Shift Z, or a held key', () => {
    press('KeyZ');
    press('KeyZ', {ctrlKey: true, shiftKey: true});
    expect(clearState.undoClear).not.toHaveBeenCalled();
    press('KeyZ', {ctrlKey: true});
    press('KeyZ', {ctrlKey: true, repeat: true});
    expect(clearState.undoClear).toHaveBeenCalledTimes(1);
  });

  it('ignores an event that is already handled', () => {
    const event = new KeyboardEvent('keydown', {code: 'F2', cancelable: true});
    event.preventDefault();
    handleClearKey(event);
    expect(clearState.clearLayer).not.toHaveBeenCalled();
  });
});
