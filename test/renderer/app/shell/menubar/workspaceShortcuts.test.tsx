import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {useMacroPalette} from '@renderer/features/tools/macros/actions/useMacroPalette';
import {workspaceShortcuts} from '@renderer/app/shell/menubar/workspaceShortcuts';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

afterEach(() => {
  cleanup();
  delete window.llp;
  useMacroPalette.getState().close();
});

describe('workspace defaults from S1', () => {
  it('keeps Ctrl S in the inline song editor instead of switching to 진행', () => {
    const onWorkspace = vi.fn();
    const save = vi.fn();
    renderHook(() =>
      useWindowShortcuts([
        ...workspaceShortcuts({
          onWorkspace,
          onMedia: vi.fn(),
          imported: false,
          editingSong: true,
        }),
        {id: 'songWindow.save', context: 'song', run: save},
      ]),
    );
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'KeyS',
          ctrlKey: true,
          cancelable: true,
        }),
      );
    });
    expect(save).toHaveBeenCalledOnce();
    expect(onWorkspace).not.toHaveBeenCalled();
  });
  it('opens screen settings with Ctrl Alt 1 without changing workspace', () => {
    const openScreens = vi.fn();
    window.llp = mockLlpApi({window: {openScreens}});
    const onWorkspace = vi.fn();
    renderHook(() =>
      useWindowShortcuts(
        workspaceShortcuts({onWorkspace, onMedia: vi.fn(), imported: false}),
      ),
    );
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'Digit1',
          ctrlKey: true,
          altKey: true,
          cancelable: true,
        }),
      );
    });
    expect(openScreens).toHaveBeenCalledOnce();
    expect(onWorkspace).not.toHaveBeenCalled();
  });
  it.each([
    {code: 'KeyS', workspace: 'show'},
    {code: 'KeyR', workspace: 'prep'},
  ])('routes $code to $workspace', ({code, workspace}) => {
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
          cancelable: true,
        }),
      );
    });
    expect(onWorkspace).toHaveBeenCalledExactlyOnceWith(workspace);
  });

  it('leaves Ctrl E for the selected Bible verse editor', () => {
    const onWorkspace = vi.fn();
    renderHook(() =>
      useWindowShortcuts(
        workspaceShortcuts({onWorkspace, onMedia: vi.fn(), imported: false}),
      ),
    );
    const edit = new KeyboardEvent('keydown', {
      code: 'KeyE',
      ctrlKey: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(edit);
    });
    expect(onWorkspace).not.toHaveBeenCalled();
    expect(edit.defaultPrevented).toBe(false);
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
