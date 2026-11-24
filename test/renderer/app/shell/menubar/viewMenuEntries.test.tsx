import {cleanup} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useShowToolTab} from '@renderer/features/tools/showToolTab';
import {useMacroPalette} from '@renderer/features/tools/macros/actions/useMacroPalette';
import {
  showViewMenuEntries,
  viewMenuEntries,
  type ContinuousRow,
} from '@renderer/app/shell/menubar/viewMenuEntries';
import {menuItems} from '@renderer/ui/menus/menuModel';
import {fullScreenRow} from '@renderer/app/shell/menubar/viewToggles';

afterEach(() => {
  cleanup();
  delete window.llp;
  useMacroPalette.getState().close();
});

const CONTINUOUS_OFF = {on: false, reason: undefined, toggle: () => undefined};
const idleFullScreen = fullScreenRow(false);

describe('the 보기 menu', () => {
  it('shows 이어서 진행 as a check that follows the choice and flips it', () => {
    const toggle = vi.fn();
    const find = (continuous: ContinuousRow) =>
      menuItems(showViewMenuEntries(continuous, CONTINUOUS_OFF)).find(
        row => row.id === 'continuous',
      );
    expect(find({on: false, reason: undefined, toggle})).toMatchObject({
      check: 'checkbox',
      checked: false,
      disabled: false,
    });
    const on = find({on: true, reason: undefined, toggle});
    expect(on).toMatchObject({check: 'checkbox', checked: true});
    on?.onSelect?.();
    expect(toggle).toHaveBeenCalledOnce();
    expect(
      find({on: false, reason: '새 버전의 파일이라 바꿀 수 없습니다.', toggle}),
    ).toMatchObject({
      disabled: true,
      title: '새 버전의 파일이라 바꿀 수 없습니다.',
    });
  });

  it('exposes a separate continuous grid check', () => {
    const toggle = vi.fn();
    const rows = menuItems(
      showViewMenuEntries(CONTINUOUS_OFF, {
        on: true,
        reason: undefined,
        toggle,
      }),
    );
    const grid = rows.find(row => row.id === 'continuous-grid');
    expect(grid).toMatchObject({check: 'checkbox', checked: true});
    expect(rows.find(row => row.id === 'continuous')).toMatchObject({
      checked: false,
    });
    grid?.onSelect?.();
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('explains unavailable workspace and media handlers', () => {
    const rows = menuItems(
      viewMenuEntries({
        onWorkspace: undefined,
        onMedia: undefined,
        fullScreen: idleFullScreen,
      }),
    );
    for (const id of [
      'workspace.show',
      'workspace.prep',
      'tool.timer',
      'palette',
    ]) {
      expect(rows.find(row => row.id === id)).toMatchObject({
        disabled: true,
        title: '이 창에서는 쓸 수 없음',
      });
    }
    expect(rows.find(row => row.id === 'workspace.media')).toMatchObject({
      disabled: true,
      title: '이 창에서는 쓸 수 없음',
    });
  });

  it('opens a 진행 도구 tab in 진행', () => {
    const onWorkspace = vi.fn();
    const entries = viewMenuEntries({
      onWorkspace,
      onMedia: () => undefined,
      fullScreen: idleFullScreen,
    });
    const timer = entries.find(entry => entry.id === 'tool.timer');
    if (timer?.kind !== 'item') throw new Error('Missing timer row');
    timer.onSelect?.();
    expect(useShowToolTab.getState().tool).toBe('timer');
    expect(onWorkspace).toHaveBeenCalledWith('show');
  });

  it('opens the existing palette in the macro tool', () => {
    const onWorkspace = vi.fn();
    const item = viewMenuEntries({
      onWorkspace,
      onMedia: undefined,
      fullScreen: idleFullScreen,
    }).find(entry => entry.id === 'palette');
    if (item?.kind !== 'item') throw new Error('Missing palette row');
    item.onSelect?.();
    expect(useMacroPalette.getState().open).toBe(true);
    expect(useShowToolTab.getState().tool).toBe('macro');
    expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('show');
  });
});
