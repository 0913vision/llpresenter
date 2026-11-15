import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {
  DraftOverlay,
  NumberJumpOverlay,
} from '@renderer/features/presentation/DraftOverlay';
import {useNumberJump} from '@renderer/features/presentation/numberJump';

afterEach(() => {
  cleanup();
  useNumberJump.setState({value: ''});
});

it('shows the slide number at the right without escape instructions', () => {
  useNumberJump.setState({value: '25'});
  render(<NumberJumpOverlay />);
  const overlay = screen.getByRole('status');
  expect(overlay.textContent).toContain('25');
  expect(overlay.textContent.toLowerCase()).not.toContain('esc');
  expect(overlay.querySelector('strong')?.textContent).toBe('25');
});

it('opens a real Bible modal and closes on Escape', () => {
  const close = vi.fn();
  render(
    <DraftOverlay kind="bible" onClose={close}>
      <input aria-label="Book" />
    </DraftOverlay>,
  );
  const dialog = screen.getByRole('dialog');
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(dialog.textContent.toLowerCase()).not.toContain('esc');
  fireEvent.keyDown(screen.getByRole('textbox', {name: 'Book'}), {
    key: 'Escape',
  });
  expect(close).toHaveBeenCalledOnce();
});
