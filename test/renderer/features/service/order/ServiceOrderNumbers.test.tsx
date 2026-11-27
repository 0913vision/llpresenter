import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';

afterEach(() => {
  cleanup();
});

it('numbers the items of the 예배 순서 in 진행 as 준비 does (USER Nov 27)', () => {
  seedSampleService();
  render(<ServiceOrderList workspace="show" />);
  const rows = screen.getAllByRole('option');
  expect(rows.length).toBeGreaterThan(1);
  expect(rows[0]?.textContent).toMatch(/^1\D/u);
  expect(rows[1]?.textContent).toMatch(/^2\D/u);
});
