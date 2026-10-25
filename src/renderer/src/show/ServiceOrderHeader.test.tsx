import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {applyService, useShow} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {emptyLiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {ServiceOrderHeader} from './ServiceOrderHeader';
import {sampleService, seedSampleService} from './testing/sampleService';

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

  it('keeps the full long name and shows it in a tooltip when truncated', async () => {
    const name = '가을 감사 예배와 함께하는 온 가족 특별 찬양 예배';
    applyService({...sampleService, name});
    render(<ServiceOrderHeader />);
    const title = screen.getByText(name);
    Object.defineProperties(title, {
      clientWidth: {value: 160},
      scrollWidth: {value: 420},
    });
    const tooltip = await hoverForTooltip(title);
    expect(tooltip?.textContent).toBe(name);
    expect(title.textContent).toContain(name);
  });

  it('shows no tooltip for a name that fits', async () => {
    render(<ServiceOrderHeader />);
    const title = screen.getByText(sampleService.name);
    Object.defineProperties(title, {
      clientWidth: {value: 160},
      scrollWidth: {value: 80},
    });
    expect(await hoverForTooltip(title)).toBeNull();
  });

  it('shows the panel label without an arrow after the service closes', () => {
    const {container} = render(<ServiceOrderHeader />);
    act(() => applyService(null));
    expect(screen.getByText('예배 순서')).toBeDefined();
    expect(screen.queryByText(sampleService.name)).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('opens the picker without changing the service or output', async () => {
    const state = emptyLiveState();
    useLive.setState({state});
    const sent: LiveCommand[] = [];
    window.llp = fakeLlpApi({live: {send: command => sent.push(command)}});
    render(<ServiceOrderHeader />);
    await act(async () => {
      fireEvent.click(screen.getByText(sampleService.name));
    });
    expect(screen.getByRole('menu')).toBeDefined();
    expect(screen.getByText(sampleService.name)).toBeDefined();
    expect(sent).toEqual([]);
    expect(useLive.getState().state).toBe(state);
    expect(useShow.getState().serviceId).toBe(sampleService.id);
  });
});
