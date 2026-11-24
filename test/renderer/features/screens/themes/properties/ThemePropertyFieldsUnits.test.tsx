import {render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {ThemeNumber} from '@renderer/features/screens/themes/properties/ThemePropertyFields';

it('shows the line height as a rounded multiplier without changing its value', () => {
  const change = vi.fn();
  render(
    <ThemeNumber
      label="줄 간격"
      value={1.26851}
      max={3}
      step={0.05}
      reason={undefined}
      change={change}
    />,
  );
  expect(screen.getByRole('spinbutton', {name: '줄 간격'})).toHaveProperty(
    'value',
    '1.27',
  );
  expect(screen.getByText('배')).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
});

it('shows pixel units for text size', () => {
  render(
    <ThemeNumber
      label="크기"
      value={42}
      max={100}
      reason={undefined}
      change={vi.fn()}
    />,
  );
  expect(screen.getByText('px')).toBeTruthy();
});
