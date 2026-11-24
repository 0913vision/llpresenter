import {act, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {applyService} from '@renderer/session/show/show';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';
import {ServiceOrderHeader} from '@renderer/features/service/order/picker/ServiceOrderHeader';
import {
  sampleService,
  seedSampleService,
} from '@fixtures/renderer/session/sampleService';

beforeEach(seedSampleService);
afterEach(() => {
  resetTooltips();
  delete window.llp;
});

describe('ServiceOrderHeader', () => {
  it('shows the open service name and disables the picker outside Electron', () => {
    const {container} = render(<ServiceOrderHeader />);
    expect(screen.getByText(sampleService.name)).toBeDefined();
    expect(screen.queryByText('예배 순서')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });

  it('updates when the open service changes without remounting', () => {
    render(<ServiceOrderHeader />);
    act(() =>
      applyService({...sampleService, id: 'evening', name: '저녁 예배'}),
    );
    expect(screen.getByText('저녁 예배')).toBeDefined();
    expect(screen.queryByText(sampleService.name)).toBeNull();
  });

  it('shows the panel label without an arrow after the service closes', () => {
    const {container} = render(<ServiceOrderHeader />);
    act(() => applyService(null));
    expect(screen.getByText('예배 순서')).toBeDefined();
    expect(screen.queryByText(sampleService.name)).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
