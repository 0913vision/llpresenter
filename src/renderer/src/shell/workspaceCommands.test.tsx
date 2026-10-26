import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useWindowShortcuts} from './windowShortcuts';
import {workspaceShortcuts} from './workspaceCommands';

afterEach(cleanup);

describe('workspace defaults from S1', () => {
  it.each([
    {code: 'KeyS', workspace: 'show'},
    {code: 'KeyE', workspace: 'prep'},
    {code: 'KeyR', workspace: 'prep'},
    {code: 'Digit1', workspace: 'screens', altKey: true},
  ])('routes $code to $workspace', ({code, workspace, altKey = false}) => {
    const onWorkspace = vi.fn();
    renderHook(() =>
      useWindowShortcuts(
        workspaceShortcuts({onWorkspace, onMedia: vi.fn(), imported: false}),
      ),
    );
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          code,
          ctrlKey: true,
          altKey,
          cancelable: true,
        }),
      );
    });
    expect(onWorkspace).toHaveBeenCalledExactlyOnceWith(workspace);
  });

  it('leaves Ctrl S to an imported editor and plain paste to text fields', () => {
    const onWorkspace = vi.fn();
    const onMedia = vi.fn();
    renderHook(() =>
      useWindowShortcuts(
        workspaceShortcuts({onWorkspace, onMedia, imported: true}),
      ),
    );
    const save = new KeyboardEvent('keydown', {
      code: 'KeyS',
      ctrlKey: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(save);
    });
    expect(save.defaultPrevented).toBe(false);
    const input = document.createElement('input');
    document.body.append(input);
    const paste = new KeyboardEvent('keydown', {
      code: 'KeyV',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      input.dispatchEvent(paste);
    });
    input.remove();
    expect(paste.defaultPrevented).toBe(false);
    expect(onWorkspace).not.toHaveBeenCalled();
    expect(onMedia).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'KeyV',
          ctrlKey: true,
          shiftKey: true,
          cancelable: true,
        }),
      );
    });
    expect(onMedia).toHaveBeenCalledOnce();
  });
});
