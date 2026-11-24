import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {NumberJumpOverlay} from '@renderer/features/presentation/keyboard/NumberJumpOverlay';
import {useNumberJump} from '@renderer/features/presentation/keyboard/numberJump';

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
