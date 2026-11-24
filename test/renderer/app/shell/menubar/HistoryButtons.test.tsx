import {useState} from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {HistoryButtons} from '@renderer/app/shell/menubar/HistoryButtons';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {editMenuEntries} from '@renderer/app/shell/menubar/editMenuEntries';
import {menuItems} from '@renderer/ui/menus/menuModel';

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

it('uses native text history for both toolbar and edit menu before theme history', async () => {
  const themeUndo = vi.fn();
  const native = vi.fn();
  window.llp = mockLlpApi({window: {editText: native}});
  Object.defineProperty(document, 'queryCommandEnabled', {
    configurable: true,
    value: () => true,
  });
  function Editor() {
    useWindowShortcuts([{id: 'edit.undo', when: () => true, run: themeUndo}]);
    return (
      <>
        <HistoryButtons />
        <input aria-label="Theme name" />
      </>
    );
  }
  try {
    render(
      <div data-workspace-layout="screens">
        <Editor />
      </div>,
    );
    const field = screen.getByRole('textbox', {name: 'Theme name'});
    fireEvent.focusIn(field);
    fireEvent.click(screen.getByRole('button', {name: '실행 취소'}));
    expect(native).toHaveBeenCalledWith('undo');
    expect(themeUndo).not.toHaveBeenCalled();
    const row = menuItems(editMenuEntries(field)).find(
      item => item.id === 'undo',
    );
    row?.onSelect?.();
    await waitFor(() => expect(native).toHaveBeenCalledTimes(2));
    expect(themeUndo).not.toHaveBeenCalled();
  } finally {
    Reflect.deleteProperty(document, 'queryCommandEnabled');
    delete window.llp;
  }
});

it('keeps song editor text on its shared history', () => {
  const songUndo = vi.fn();
  function Editor() {
    useWindowShortcuts([
      {id: 'edit.undo', context: 'song', when: () => true, run: songUndo},
    ]);
    return (
      <>
        <HistoryButtons />
        <textarea aria-label="Lyrics" />
      </>
    );
  }
  render(<Editor />);
  fireEvent.focusIn(screen.getByRole('textbox', {name: 'Lyrics'}));
  fireEvent.click(screen.getByRole('button', {name: '실행 취소'}));
  expect(songUndo).toHaveBeenCalledOnce();
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
