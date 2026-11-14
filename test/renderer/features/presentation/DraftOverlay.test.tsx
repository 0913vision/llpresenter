import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {DraftOverlay} from '@renderer/features/presentation/DraftOverlay';

afterEach(cleanup);

it('shows one shared cancel action for Delete and Escape', () => {
  render(
    <DraftOverlay kind="number" onClose={vi.fn()}>
      25
    </DraftOverlay>,
  );
  const text = screen.getByRole('status').textContent?.replace(/\s+/gu, ' ');
  expect(text).toContain('Enter 이동');
  expect(text).toContain('Delete, Esc 취소');
  expect(text).not.toContain('전체 지우기');
  expect(text).not.toContain('Esc 닫기');
});
