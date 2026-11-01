import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {applyService} from '@renderer/session/show';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {createServiceId} from '@core/schema/ids';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';
import {ServiceOrderHeader} from '@renderer/features/service/order/ServiceOrderHeader';
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

  it('ends the picker with only New Service and opens its dialog', async () => {
    window.llp = mockLlpApi({
      services: {
        list: () =>
          Promise.resolve([
            {
              id: createServiceId('00000000-0000-4000-8000-000000000009'),
              name: '저녁 예배',
              date: '2026-10-25T19:00',
              access: 'editable',
            },
          ]),
      },
    });
    render(<ServiceOrderHeader />);
    await act(async () => {
      fireEvent.click(screen.getByText(sampleService.name));
    });
    const items = [
      ...screen.getByRole('menu').querySelectorAll('[role^="menuitem"]'),
    ].map(item => item.textContent);
    expect(items).toEqual([expect.stringContaining('저녁 예배'), '새 예배…']);
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', {name: '새 예배…'}));
    });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('dialog', {name: '새 예배'})).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: '취소'}));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps New Service available without an open service', async () => {
    window.llp = mockLlpApi();
    render(<ServiceOrderHeader />);
    act(() => applyService(null));
    await act(async () => {
      fireEvent.click(screen.getByText('예배 순서'));
    });
    expect(
      screen.getAllByRole('menuitem').map(item => item.textContent),
    ).toEqual(['새 예배…']);
    expect(
      screen
        .getByRole('menuitem', {name: '새 예배…'})
        .getAttribute('aria-disabled'),
    ).toBeNull();
  });
});
