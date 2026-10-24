import {renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as clearState from '@renderer/state/clear';
import type {Workspace} from '@renderer/shell/Toolbar';
import {handleClearKey, useClearKeys} from './clearKeys';

function pressIn(
  workspace: Workspace,
  code: string,
  options: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code,
    key: 'Unidentified',
    bubbles: true,
    cancelable: true,
    ...options,
  });
  Object.defineProperty(event, 'target', {value: document.body});
  handleClearKey(event, workspace);
  return event;
}

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
  handleClearKey(event, 'show');
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

  it.each<Workspace>(['show', 'prep', 'screens'])(
    'clear in the %s workspace',
    workspace => {
      pressIn(workspace, 'F2');
      expect(clearState.clearLayer).toHaveBeenCalledWith('slide');
    },
  );

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
    handleClearKey(event, 'show');
    expect(clearState.clearLayer).not.toHaveBeenCalled();
  });
});

describe('handleClearKey Ctrl Z', () => {
  it.each<Workspace>(['show', 'screens'])(
    'undoes the last clear in the %s workspace',
    workspace => {
      const event = pressIn(workspace, 'KeyZ', {ctrlKey: true});
      expect(event.defaultPrevented).toBe(true);
      expect(clearState.undoClear).toHaveBeenCalledTimes(1);
    },
  );

  it('is the edit undo in 준비 and does not undo a clear', () => {
    const event = pressIn('prep', 'KeyZ', {ctrlKey: true});
    expect(clearState.undoClear).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    ['a text input', () => appendTo('input', {type: 'text'})],
    ['an input without a type', () => appendTo('input')],
    ['a search input', () => appendTo('input', {type: 'search'})],
    ['a textarea', () => appendTo('textarea')],
    ['contenteditable true', () => appendTo('div', {contenteditable: 'true'})],
    ['an empty contenteditable', () => appendTo('div', {contenteditable: ''})],
    [
      'contenteditable plaintext-only',
      () => appendTo('div', {contenteditable: 'plaintext-only'}),
    ],
  ])('is left to %s, where it is the edit undo', (_name, create) => {
    const event = press('KeyZ', {ctrlKey: true}, create());
    expect(clearState.undoClear).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('is left to an element inside a contenteditable block', () => {
    const block = appendTo('div', {contenteditable: 'plaintext-only'});
    const inner = block.appendChild(document.createElement('span'));
    press('KeyZ', {ctrlKey: true}, inner);
    expect(clearState.undoClear).not.toHaveBeenCalled();
  });

  it.each([
    ['a range slider', () => appendTo('input', {type: 'range'})],
    ['a checkbox', () => appendTo('input', {type: 'checkbox'})],
    ['a radio button', () => appendTo('input', {type: 'radio'})],
    ['a button input', () => appendTo('input', {type: 'button'})],
    ['a select', () => appendTo('select')],
    ['a button', () => appendTo('button')],
    [
      'contenteditable false',
      () => appendTo('div', {contenteditable: 'false'}),
    ],
  ])('still undoes a clear from %s, which is not text entry', (_n, create) => {
    expect(press('KeyZ', {ctrlKey: true}, create()).defaultPrevented).toBe(
      true,
    );
    expect(clearState.undoClear).toHaveBeenCalledTimes(1);
  });

  it('leaves an IME composition alone', () => {
    const event = press('KeyZ', {ctrlKey: true, isComposing: true});
    expect(clearState.undoClear).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not undo with Z alone, Ctrl Shift Z, or Ctrl Alt Z', () => {
    press('KeyZ');
    press('KeyZ', {ctrlKey: true, shiftKey: true});
    press('KeyZ', {ctrlKey: true, altKey: true});
    expect(clearState.undoClear).not.toHaveBeenCalled();
  });

  it('runs once for a held key', () => {
    press('KeyZ', {ctrlKey: true});
    press('KeyZ', {ctrlKey: true, repeat: true});
    expect(clearState.undoClear).toHaveBeenCalledTimes(1);
  });

  it('leaves a shortcut recording field alone', () => {
    const recorder = appendTo('div', {'data-shortcut-recording': ''});
    press('KeyZ', {ctrlKey: true}, recorder);
    expect(clearState.undoClear).not.toHaveBeenCalled();
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
    renderHook(() => useClearKeys('show'));
    const field = appendTo('input');
    field.addEventListener('keydown', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    pressOn(field, 'F2');
    expect(clearState.clearLayer).toHaveBeenCalledWith('slide');
  });

  it('follows the workspace on screen', () => {
    const initialProps: {workspace: Workspace} = {workspace: 'show'};
    const {rerender} = renderHook(
      ({workspace}: {workspace: Workspace}) => useClearKeys(workspace),
      {initialProps},
    );
    pressOn(document.body, 'KeyZ', {ctrlKey: true});
    expect(clearState.undoClear).toHaveBeenCalledTimes(1);
    rerender({workspace: 'prep'});
    pressOn(document.body, 'KeyZ', {ctrlKey: true});
    expect(clearState.undoClear).toHaveBeenCalledTimes(1);
  });

  it('stops listening when it unmounts', () => {
    const {unmount} = renderHook(() => useClearKeys('show'));
    unmount();
    pressOn(document.body, 'F2');
    expect(clearState.clearLayer).not.toHaveBeenCalled();
  });
});
