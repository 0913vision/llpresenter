import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useWindowShortcuts} from '../../platform/windowShortcuts';
import {useShowToolTab} from '@renderer/features/tools/state/showToolTab';
import {useMacroPalette} from '@renderer/features/tools/state/macroPalette';
import {workspaceMenu, workspaceShortcuts} from './workspaceCommands';
import {menuItems} from '@renderer/ui/menuModel';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';

afterEach(() => {
  cleanup();
  delete window.llp;
  useMacroPalette.getState().close();
});

describe('workspace defaults from S1', () => {
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
    {code: 'KeyE', workspace: 'prep'},
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

describe('workspaceMenu', () => {
  it('explains unavailable workspace and media handlers', () => {
    const rows = menuItems(
      workspaceMenu({onWorkspace: undefined, onMedia: undefined}),
    );
    for (const id of [
      'workspace.show',
      'workspace.prep',
      'tool.timer',
      'palette',
    ]) {
      expect(rows.find(row => row.id === id)).toMatchObject({
        disabled: true,
        title: '작업 화면 연결 안 됨',
      });
    }
    expect(rows.find(row => row.id === 'workspace.media')).toMatchObject({
      disabled: true,
      title: '미디어 화면 연결 안 됨',
    });
  });
  it('lists the rows of the ProPresenter View menu in its order', () => {
    const entries = workspaceMenu({
      onWorkspace: () => undefined,
      onMedia: () => undefined,
    });
    expect(
      entries.map(entry =>
        entry.kind === 'item'
          ? `${entry.label}${entry.disabled === true ? ' (off)' : ''}`
          : '|',
      ),
    ).toEqual([
      '진행',
      '슬라이드 편집기 (off)',
      '준비',
      '성경 (off)',
      '|',
      '이어서 진행 (off)',
      '|',
      '슬라이드 보기 (off)',
      '|',
      '오디오',
      '무대',
      '타이머',
      '메시지',
      '공지',
      '소품',
      '매크로',
      '|',
      '타임코드 (off)',
      '미디어',
      '캘린더 (off)',
      '동작 팔레트',
      '테스트 화면 (off)',
      '|',
      '미리보기 (off)',
      '|',
      '전체 화면 (off)',
    ]);
  });

  it('opens a 진행 도구 tab in 진행', () => {
    const onWorkspace = vi.fn();
    const entries = workspaceMenu({onWorkspace, onMedia: () => undefined});
    const timer = entries.find(entry => entry.id === 'tool.timer');
    if (timer?.kind !== 'item') throw new Error('Missing timer row');
    timer.onSelect?.();
    expect(useShowToolTab.getState().tool).toBe('timer');
    expect(onWorkspace).toHaveBeenCalledWith('show');
  });

  it('opens the existing palette in the macro tool', () => {
    const onWorkspace = vi.fn();
    const item = workspaceMenu({onWorkspace, onMedia: undefined}).find(
      entry => entry.id === 'palette',
    );
    if (item?.kind !== 'item') throw new Error('Missing palette row');
    item.onSelect?.();
    expect(useMacroPalette.getState().open).toBe(true);
    expect(useShowToolTab.getState().tool).toBe('macro');
    expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('show');
  });
});
