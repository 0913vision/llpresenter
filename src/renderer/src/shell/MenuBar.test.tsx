import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {MenuBar} from './MenuBar';

afterEach(() => {
  resetTooltips();
  cleanup();
  delete window.llp;
});

describe('MenuBar', () => {
  it('shows the service name in the center', () => {
    render(<MenuBar title="주일 예배" />);
    expect(screen.getByText('주일 예배')).toBeTruthy();
    expect(screen.queryByText('LoveLight Presenter')).toBeNull();
  });

  it('marks the menus as a menu bar of menus that open a menu', () => {
    render(<MenuBar title="" />);
    const bar = screen.getByRole('menubar', {name: '메뉴'});
    const items = screen.getAllByRole('menuitem');
    expect(items.map(item => item.textContent)).toEqual([
      '파일',
      '편집',
      '보기',
      '출력',
      '창',
      '도움말',
    ]);
    for (const item of items) {
      expect(bar.contains(item)).toBe(true);
      expect(item.getAttribute('aria-haspopup')).toBe('menu');
      expect(item.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('names the window buttons with aria-label and a tooltip, not a title', async () => {
    render(<MenuBar title="" />);
    const minimize = screen.getByRole('button', {name: '최소화'});
    expect(document.querySelectorAll('[title]')).toHaveLength(0);
    expect((await hoverForTooltip(minimize))?.textContent).toBe('최소화');
  });

  it('sends the window action of a button', () => {
    const control = vi.fn();
    window.llp = fakeLlpApi({window: {control}});
    render(<MenuBar title="" />);
    fireEvent.click(screen.getByRole('button', {name: '최대화'}));
    fireEvent.click(screen.getByRole('button', {name: '닫기'}));
    expect(control.mock.calls).toEqual([['toggle-maximize'], ['close']]);
  });
});
