import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as showState from '@renderer/state/show';
import {handleShowKey, handleShowKeyUp, handleShowMouseDown} from './shortcuts';

function keyEvent(params: {
  readonly type: 'keydown' | 'keyup';
  readonly code: string;
  readonly options?: KeyboardEventInit;
  readonly target?: Element;
}): KeyboardEvent {
  const {type, code, options = {}, target = document.body} = params;
  const event = new KeyboardEvent(type, {
    code,
    key: 'Unidentified',
    bubbles: true,
    cancelable: true,
    ...options,
  });
  Object.defineProperty(event, 'target', {value: target});
  return event;
}

function press(
  code: string,
  options: KeyboardEventInit = {},
  target: Element = document.body,
): KeyboardEvent {
  const event = keyEvent({type: 'keydown', code, options, target});
  handleShowKey(event);
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
  vi.spyOn(showState, 'outputNext').mockImplementation(() => undefined);
  vi.spyOn(showState, 'outputPrevious').mockImplementation(() => undefined);
  vi.spyOn(showState, 'outputLabel').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('handleShowKey next and previous', () => {
  it.each(['ArrowRight', 'Space', 'PageDown'])(
    'outputs the next 장 with %s',
    code => {
      expect(press(code).defaultPrevented).toBe(true);
      expect(showState.outputNext).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['ArrowLeft', 'PageUp'])('outputs the previous 장 with %s', code => {
    expect(press(code).defaultPrevented).toBe(true);
    expect(showState.outputPrevious).toHaveBeenCalledTimes(1);
  });

  it('matches the physical key and not the character', () => {
    press('ArrowRight', {key: 'ㅊ'});
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
    press('KeyA', {key: 'ArrowRight'});
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    press('ArrowUp');
    press('ArrowDown');
    press('Enter');
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
  });

  it('ignores keys with a modifier', () => {
    press('ArrowRight', {ctrlKey: true});
    press('ArrowRight', {shiftKey: true});
    press('PageDown', {altKey: true});
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('runs a held key once and still swallows the repeats', () => {
    press('PageDown');
    const repeated = press('PageDown', {repeat: true});
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
    expect(repeated.defaultPrevented).toBe(true);
  });

  it('ignores an event that is already handled', () => {
    const event = keyEvent({type: 'keydown', code: 'ArrowRight'});
    event.preventDefault();
    handleShowKey(event);
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('works with the 장 grid and the 예배 순서 list in focus', () => {
    const grid = appendTo('div', {'data-slide-grid': ''});
    const tile = grid.appendChild(document.createElement('button'));
    const list = appendTo('div', {'data-service-list': ''});
    const row = list.appendChild(document.createElement('button'));
    press('ArrowRight', {}, tile);
    press('Space', {}, row);
    expect(showState.outputNext).toHaveBeenCalledTimes(2);
  });
});

describe('handleShowKey where another part owns the key', () => {
  it('leaves keys to a text field', () => {
    const event = press('Space', {}, appendTo('input'));
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves keys to an IME composition', () => {
    press('ArrowRight', {isComposing: true});
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it.each(['menu', 'dialog', 'alertdialog'])(
    'leaves keys to an open %s',
    role => {
      const container = appendTo('div', {role});
      const item = container.appendChild(document.createElement('button'));
      press('Space', {}, item);
      expect(showState.outputNext).not.toHaveBeenCalled();
    },
  );
});

describe('handleShowKey jump keys', () => {
  it('outputs the 이름표 of a bound key and swallows it', () => {
    const event = press('KeyC');
    expect(showState.outputLabel).toHaveBeenCalledWith('후렴');
    expect(event.defaultPrevented).toBe(true);
  });

  it('treats numpad digits as the digits of the top row', () => {
    press('Numpad1');
    expect(showState.outputLabel).toHaveBeenCalledWith('1절');
  });

  it('ignores a key that no 이름표 uses', () => {
    const event = press('KeyZ');
    expect(showState.outputLabel).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('runs a held jump key once', () => {
    press('KeyC');
    press('KeyC', {repeat: true});
    expect(showState.outputLabel).toHaveBeenCalledTimes(1);
  });

  it('ignores a jump key with a modifier and inside a text field', () => {
    press('KeyC', {ctrlKey: true});
    press('KeyC', {}, appendTo('textarea'));
    expect(showState.outputLabel).not.toHaveBeenCalled();
  });
});

describe('handleShowKeyUp', () => {
  it('stops Space from pressing a focused button on key up', () => {
    const event = keyEvent({
      type: 'keyup',
      code: 'Space',
      target: appendTo('button'),
    });
    handleShowKeyUp(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves Space to a text field and to other keys', () => {
    const inField = keyEvent({
      type: 'keyup',
      code: 'Space',
      target: appendTo('input'),
    });
    handleShowKeyUp(inField);
    const other = keyEvent({
      type: 'keyup',
      code: 'Enter',
      target: appendTo('button'),
    });
    handleShowKeyUp(other);
    expect(inField.defaultPrevented).toBe(false);
    expect(other.defaultPrevented).toBe(false);
  });
});

describe('handleShowMouseDown', () => {
  function click(target: Element, button = 0): MouseEvent {
    const event = new MouseEvent('mousedown', {
      button,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', {value: target});
    handleShowMouseDown(event);
    return event;
  }

  it('keeps focus off a clicked button', () => {
    expect(click(appendTo('button')).defaultPrevented).toBe(true);
    expect(click(appendTo('div', {role: 'tab'})).defaultPrevented).toBe(true);
  });

  it('lets text fields, the 장 grid, and the 예배 순서 list take focus', () => {
    const grid = appendTo('div', {'data-slide-grid': ''});
    const list = appendTo('div', {'data-service-list': ''});
    const tile = grid.appendChild(document.createElement('button'));
    const row = list.appendChild(document.createElement('button'));
    expect(click(tile).defaultPrevented).toBe(false);
    expect(click(row).defaultPrevented).toBe(false);
    expect(click(appendTo('input')).defaultPrevented).toBe(false);
  });

  it('lets a menu or a dialog take focus', () => {
    const menu = appendTo('div', {role: 'menu'});
    const item = menu.appendChild(document.createElement('button'));
    expect(click(item).defaultPrevented).toBe(false);
  });

  it('ignores other mouse buttons and other elements', () => {
    expect(click(appendTo('button'), 2).defaultPrevented).toBe(false);
    expect(click(appendTo('div')).defaultPrevented).toBe(false);
  });
});
