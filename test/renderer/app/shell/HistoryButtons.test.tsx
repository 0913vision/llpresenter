import {useState} from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {HistoryButtons} from '@renderer/app/shell/HistoryButtons';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';

it('uses the focused editor history and follows its availability', async () => {
  function Editor() {
    const [value, setValue] = useState(0);
    useWindowShortcuts([
      {
        id: 'edit.undo',
        when: event =>
          event.target instanceof Element && event.target.id === 'editor',
        unavailable: () => (value ? undefined : 'empty'),
        run: () => setValue(v => v - 1),
      },
      {
        id: 'edit.redo',
        when: event =>
          event.target instanceof Element && event.target.id === 'editor',
        unavailable: () => (value ? 'empty' : undefined),
        run: () => setValue(v => v + 1),
      },
    ]);
    return (
      <>
        <HistoryButtons />
        <button id="editor">Editor {value}</button>
      </>
    );
  }
  render(<Editor />);
  fireEvent.focusIn(screen.getByRole('button', {name: 'Editor 0'}));
  const undo = screen.getByRole('button', {name: '실행 취소'});
  const redo = screen.getByRole('button', {name: '다시 실행'});
  expect(undo.getAttribute('aria-disabled')).toBe('true');
  expect(redo.getAttribute('aria-disabled')).toBeNull();
  fireEvent.click(redo);
  await screen.findByRole('button', {name: 'Editor 1'});
  await waitFor(() => expect(undo.getAttribute('aria-disabled')).toBeNull());
  fireEvent.click(undo);
  await screen.findByRole('button', {name: 'Editor 0'});
});

it('disables native text undo until the text field has an undo step', () => {
  let canUndo = false;
  Object.defineProperty(document, 'queryCommandEnabled', {
    configurable: true,
    value: vi.fn((command: string) => command === 'undo' && canUndo),
  });
  try {
    render(
      <>
        <HistoryButtons />
        <input aria-label="Text" />
      </>,
    );
    const input = screen.getByRole('textbox', {name: 'Text'});
    fireEvent.focusIn(input);
    const undo = screen.getByRole('button', {name: '실행 취소'});
    expect(undo.getAttribute('aria-disabled')).toBe('true');
    canUndo = true;
    fireEvent.input(input, {target: {value: 'a'}});
    expect(undo.getAttribute('aria-disabled')).toBeNull();
  } finally {
    Reflect.deleteProperty(document, 'queryCommandEnabled');
  }
});
