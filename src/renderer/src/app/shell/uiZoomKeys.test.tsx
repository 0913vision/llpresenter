import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {handleUiZoomKey, useUiZoomKeys} from './uiZoomKeys';

const changeZoom = vi.fn(() => Promise.resolve(100));
const log = vi.fn();

function press(
  code: string,
  options: KeyboardEventInit = {},
  target: Element = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code,
    key: 'Unidentified',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  changeZoom.mockClear();
  log.mockClear();
  window.llp = mockLlpApi({ui: {changeZoom}, log: {write: log}});
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  delete window.llp;
});

describe('UI zoom keys', () => {
  it.each([
    ['Equal', false, 'ui.zoomIn'],
    ['Equal', true, 'ui.zoomIn'],
    ['NumpadAdd', false, 'ui.zoomIn'],
    ['Minus', false, 'ui.zoomOut'],
    ['NumpadSubtract', false, 'ui.zoomOut'],
    ['Digit0', false, 'ui.zoomReset'],
    ['Numpad0', false, 'ui.zoomReset'],
  ])(
    'matches Ctrl %s with shift=%s by physical code',
    (code, shiftKey, type) => {
      renderHook(() => useUiZoomKeys());
      expect(press(code, {shiftKey, key: 'ㅁ'}).defaultPrevented).toBe(true);
      expect(changeZoom).toHaveBeenCalledWith({type});
    },
  );

  it.each([
    {ctrlKey: false},
    {altKey: true},
    {metaKey: true},
    {isComposing: true},
  ])('passes a nonmatching modifier or IME event on: %j', options => {
    renderHook(() => useUiZoomKeys());
    expect(press('Equal', options).defaultPrevented).toBe(false);
    expect(changeZoom).not.toHaveBeenCalled();
  });

  it('does not normalize Shift for any alias other than Equal, or match a typed plus with another code', () => {
    renderHook(() => useUiZoomKeys());
    for (const code of [
      'Minus',
      'Digit0',
      'NumpadAdd',
      'NumpadSubtract',
      'Numpad0',
    ]) {
      expect(press(code, {shiftKey: true}).defaultPrevented).toBe(false);
    }
    expect(press('KeyA', {key: '+'}).defaultPrevented).toBe(false);
    expect(changeZoom).not.toHaveBeenCalled();
  });

  it.each(['input', 'textarea', 'menu', 'dialog', 'alertdialog'])(
    'runs before a focused %s consumes the event',
    role => {
      const field = document.body.appendChild(
        document.createElement(
          role === 'input' || role === 'textarea' ? role : 'div',
        ),
      );
      if (role !== 'input' && role !== 'textarea') {
        field.setAttribute('role', role);
      }
      const consume = vi.fn((event: Event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      field.addEventListener('keydown', consume);
      renderHook(() => useUiZoomKeys());

      expect(press('Digit0', {}, field).defaultPrevented).toBe(true);

      expect(changeZoom).toHaveBeenCalledWith({type: 'ui.zoomReset'});
      expect(consume).not.toHaveBeenCalled();
    },
  );

  it('leaves shortcut recording and active IME composition alone until they finish', () => {
    const recorder = document.body.appendChild(document.createElement('div'));
    recorder.setAttribute('data-shortcut-recording', '');
    const button = recorder.appendChild(document.createElement('button'));
    const field = document.body.appendChild(document.createElement('input'));
    renderHook(() => useUiZoomKeys());
    expect(press('Digit0', {}, button).defaultPrevented).toBe(false);
    field.dispatchEvent(
      new CompositionEvent('compositionstart', {bubbles: true}),
    );
    expect(press('Equal', {}, field).defaultPrevented).toBe(false);
    field.dispatchEvent(
      new CompositionEvent('compositionend', {bubbles: true}),
    );
    expect(press('Equal', {}, field).defaultPrevented).toBe(true);
    expect(changeZoom).toHaveBeenCalledTimes(1);
  });

  it('allows UI-key repeat and swallows recognized keys at the limit', () => {
    renderHook(() => useUiZoomKeys());
    press('Minus');
    expect(press('Minus', {repeat: true}).defaultPrevented).toBe(true);
    expect(changeZoom).toHaveBeenCalledTimes(2);
  });

  it('ignores an already handled key and releases all listeners on unmount', () => {
    const {unmount} = renderHook(() => useUiZoomKeys());
    const event = new KeyboardEvent('keydown', {
      code: 'Equal',
      ctrlKey: true,
      cancelable: true,
    });
    event.preventDefault();
    handleUiZoomKey(event);
    unmount();
    expect(press('Equal').defaultPrevented).toBe(false);
    expect(changeZoom).not.toHaveBeenCalled();
  });

  it('logs a failed invoke without an unhandled rejection', async () => {
    changeZoom.mockRejectedValueOnce(new Error('zoom failed'));
    renderHook(() => useUiZoomKeys());
    await act(async () => {
      press('Equal');
    });
    expect(log).toHaveBeenCalledWith({
      level: 'error',
      message: 'could not change UI zoom',
      detail: 'zoom failed',
    });
  });
});
