import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {setColumnDragActive} from '@renderer/platform/drag';
import {useSlideHotKeys} from '@renderer/features/presentation/useSlideHotKeys';

const dispatch = vi.hoisted(() => ({keys: new Set<string>(), output: vi.fn()}));
vi.mock('@renderer/session/show', () => ({
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
