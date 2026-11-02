import {render, renderHook, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {useShowKeys} from '@renderer/features/presentation/shortcuts';
import {CheckRow} from '@renderer/ui/Checkbox';

describe.each([['CheckRow', 'checkbox', CheckRow]] as const)(
  '진행 label clicks on a %s',
  (_name, role, Row) => {
    it('keeps the focus where it was when a label press releases over its control', async () => {
      renderHook(() => useShowKeys());
      const onChange = vi.fn();
      render(
        <>
          <button>이전</button>
          <Row label="이름표" checked={false} onChange={onChange} />
        </>,
      );
      const previous = screen.getByRole('button', {name: '이전'});
      previous.focus();

      await userEvent.pointer([
        {keys: '[MouseLeft>]', target: screen.getByText('이름표')},
        {keys: '[/MouseLeft]', target: screen.getByRole(role)},
      ]);

      expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
      expect(document.activeElement).toBe(previous);
    });
  },
);
