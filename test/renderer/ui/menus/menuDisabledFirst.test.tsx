import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {watchInputModality} from '@renderer/ui/keys/inputModality';
import {describe, expect, it} from 'vitest';
import {
  Harness,
  installMenuTestHooks,
  pointAt,
  pointedName,
} from '@fixtures/renderer/ui/menuTesting';

installMenuTestHooks();

const entries = [
  {
    kind: 'item',
    id: 'off',
    label: '붙여넣기',
    disabled: true,
    title: '복사한 항목이 없습니다.',
  },
  {kind: 'item', id: 'on', label: '새 항목'},
  {kind: 'item', id: 'last', label: '삭제'},
] as const;

describe('a menu whose first row is off', () => {
  it('points the first row that can run when a key opens it, not the row that is off', async () => {
    const stopWatching = watchInputModality(window);
    try {
      render(<Harness entries={entries} />);
      screen.getByRole('button', {name: '파일'}).focus();
      await userEvent.keyboard('{Enter}');
      expect(pointedName()).toBe('새 항목');
      await userEvent.keyboard('{ArrowUp}');
      expect(pointedName()).toBe('붙여넣기');
    } finally {
      stopWatching();
    }
  });

  it('shows the place and the reason of a row that is off when the keys move to it, not when the pointer does', async () => {
    const stopWatching = watchInputModality(window);
    try {
      render(<Harness entries={entries} />);
      screen.getByRole('button', {name: '파일'}).focus();
      await userEvent.keyboard('{Enter}{ArrowUp}');
      const off = screen.getByRole('menuitem', {name: '붙여넣기'});
      expect(off.getAttribute('data-key-pointed')).toBe('true');
      // NOTE(0913vision): A tooltip shows after its usual delay.
      const reason = await screen.findByRole('tooltip', {}, {timeout: 1500});
      expect(reason.textContent).toContain('복사한 항목이 없습니다.');
      await userEvent.keyboard('{ArrowDown}');
      expect(off.getAttribute('data-key-pointed')).toBeNull();
      expect(screen.queryByRole('tooltip')).toBeNull();
      pointAt(off);
      expect(off.getAttribute('data-key-pointed')).toBeNull();
    } finally {
      stopWatching();
    }
  });
});
