import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {setColumnDragActive} from '@renderer/platform/drag';
import {modalStack} from '@renderer/ui/modalStack';
import {useSlideHotKeys} from './useSlideHotKeys';

const dispatch = vi.hoisted(() => ({keys: new Set<string>(), output: vi.fn()}));
vi.mock('@renderer/features/presentation/state/show', () => ({
  hasSlideHotKey: (code: string) => dispatch.keys.has(code),
  outputHotKey: dispatch.output,
}));
let closeModal: (() => void) | undefined;
afterEach(() => {
  closeModal?.();
  closeModal = undefined;
  cleanup();
  document.body.replaceChildren();
  setColumnDragActive(false);
  dispatch.keys.clear();
  dispatch.output.mockClear();
});

function Host() {
  useSlideHotKeys();
  return (
    <>
      <input aria-label="lyrics" />
      <div role="listbox" aria-label="slides" tabIndex={0} />
      <button data-shortcut-recording>Recording</button>
    </>
  );
}
function setup() {
  dispatch.keys.add('KeyC');
  dispatch.keys.add('Digit1');
  return render(<Host />);
}
function press(options: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', {
    code: 'KeyC',
    key: 'ㅊ',
    bubbles: true,
    cancelable: true,
    ...options,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

it('uses physical keys, consumes held repeats once and leaves unassigned or reserved keys alone', () => {
  setup();
  expect(press().defaultPrevented).toBe(true);
  expect(press({repeat: true}).defaultPrevented).toBe(true);
  expect(dispatch.output).toHaveBeenCalledExactlyOnceWith('KeyC');
  for (const code of [
    'KeyB',
    'F1',
    'F2',
    'F3',
    'F4',
    'F5',
    'F6',
    'F7',
    'Enter',
  ]) {
    expect(press({code}).defaultPrevented).toBe(false);
  }
  expect(dispatch.output).toHaveBeenCalledOnce();
});

it('reads current assignments after an edit and removes listeners on unmount', () => {
  const view = setup();
  dispatch.keys.delete('KeyC');
  expect(press().defaultPrevented).toBe(false);
  dispatch.keys.add('KeyB');
  expect(press({code: 'KeyB'}).defaultPrevented).toBe(true);
  expect(dispatch.output).toHaveBeenCalledExactlyOnceWith('KeyB');
  view.unmount();
  expect(press({code: 'KeyB'}).defaultPrevented).toBe(false);
  expect(dispatch.output).toHaveBeenCalledOnce();
});

it.each(['ctrlKey', 'altKey', 'shiftKey', 'metaKey'])(
  'yields to a %s modified assignment',
  modifier => {
    setup();
    expect(press({[modifier]: true}).defaultPrevented).toBe(false);
    expect(dispatch.output).not.toHaveBeenCalled();
  },
);

it('yields to text entry, IME events and an ongoing composition, then resumes on the slide grid', () => {
  setup();
  const field = screen.getByRole('textbox');
  press({}, field);
  press({isComposing: true});
  press({key: 'Process'});
  fireEvent.compositionStart(field);
  press();
  expect(dispatch.output).not.toHaveBeenCalled();
  fireEvent.compositionEnd(field);
  press({}, screen.getByRole('listbox'));
  expect(dispatch.output).toHaveBeenCalledExactlyOnceWith('KeyC');
});

it('yields to modal surfaces, menus and shortcut recording controls', () => {
  setup();
  press({}, screen.getByRole('button', {name: 'Recording'}));
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  document.body.append(menu);
  press();
  menu.remove();
  const modal = document.createElement('div');
  document.body.append(modal);
  closeModal = modalStack.push(modal);
  press();
  expect(dispatch.output).not.toHaveBeenCalled();
  closeModal();
  closeModal = undefined;
  modal.remove();
  press();
  expect(dispatch.output).toHaveBeenCalledOnce();
});

it('normalizes numpad digits only with Num Lock', () => {
  setup();
  expect(press({code: 'Numpad1', key: 'End'}).defaultPrevented).toBe(false);
  const event = new KeyboardEvent('keydown', {
    code: 'Numpad1',
    key: '1',
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'getModifierState', {
    value: (name: string) => name === 'NumLock',
  });
  act(() => {
    window.dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(true);
  expect(dispatch.output).toHaveBeenCalledExactlyOnceWith('Digit1');
});

it('yields to column, native and thresholded pointer drags and resumes after they end', () => {
  setup();
  setColumnDragActive(true);
  press();
  setColumnDragActive(false);
  fireEvent.dragStart(document.body);
  press();
  fireEvent.dragEnd(document.body);
  fireEvent.pointerDown(window, {
    pointerId: 1,
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  fireEvent.pointerMove(window, {pointerId: 1, clientX: 30, clientY: 10});
  press();
  expect(dispatch.output).not.toHaveBeenCalled();
  fireEvent.pointerUp(window, {pointerId: 1});
  press();
  expect(dispatch.output).toHaveBeenCalledOnce();
});
