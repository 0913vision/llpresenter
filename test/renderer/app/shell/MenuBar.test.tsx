import {cleanup, fireEvent, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {MenuBar} from '@renderer/app/shell/MenuBar';
import {renderWithScreenSummaries as render} from '@fixtures/renderer/platform/screenSummaries';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useLive.setState({
    state: {...emptyLiveState(), outputs: {main: true, stage: false}},
  });
});

afterEach(() => {
  resetTooltips();
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
});

function outputSender() {
  const send = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  return send;
}

function outputItem(name: string): HTMLElement {
  return within(screen.getByRole('group', {name})).getByRole('menuitem', {
    name: /^출력/,
  });
}

describe('MenuBar', () => {
  it.each(['편집', '창', '도움말'])(
    'explains why %s is unavailable and ignores pointer and keyboard activation',
    async label => {
      const user = userEvent.setup();
      render(<MenuBar title="" />);
      const item = screen.getByRole('menuitem', {name: label});
      await user.click(item);
      await user.keyboard('{Enter} {ArrowDown}');
      expect(document.activeElement).toBe(item);
      expect(screen.queryByRole('menu')).toBeNull();
      expect(item.hasAttribute('title')).toBe(false);
      expect((await hoverForTooltip(item))?.textContent).toBe(
        `${label} 메뉴를 아직 지원하지 않습니다`,
      );
    },
  );

  it('names the window buttons with aria-label and a tooltip, not a title', async () => {
    render(<MenuBar title="" />);
    const minimize = screen.getByRole('button', {name: '최소화'});
    expect(document.querySelectorAll('[title]')).toHaveLength(0);
    expect((await hoverForTooltip(minimize))?.textContent).toBe('최소화');
  });

  it('sends the window action of a button', () => {
    const control = vi.fn();
    window.llp = mockLlpApi({window: {control}});
    render(<MenuBar title="" />);
    fireEvent.click(screen.getByRole('button', {name: '최대화'}));
    fireEvent.click(screen.getByRole('button', {name: '닫기'}));
    expect(control.mock.calls).toEqual([['toggle-maximize'], ['close']]);
  });

  it('shows an output command in each screen group', async () => {
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
    expect(screen.getByRole('menu', {name: '출력'})).toBeDefined();
    expect(outputItem('청중 화면').textContent).toBe('출력 끄기');
    expect(outputItem('무대 화면').textContent).toBe('출력 켜기');
    expect(outputItem('방송 화면').textContent).toBe('출력 켜기');
    expect(screen.queryByRole('menuitem', {name: /경고 보기/})).toBeNull();
  });

  it.each([
    {name: '청중 화면', screenId: 'main', on: false},
    {name: '무대 화면', screenId: 'stage', on: true},
    {name: '방송 화면', screenId: 'broadcast', on: true},
  ])(
    'turns $name output on=$on with a click and closes the menu',
    async ({name, screenId, on}) => {
      const send = outputSender();
      render(<MenuBar title="" />);
      await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
      await userEvent.click(outputItem(name));
      expect(send).toHaveBeenCalledExactlyOnceWith({
        type: 'live.batch',
        commands: [{type: 'output.set', screenId, on}],
      });
      expect(screen.queryByRole('menu', {name: '출력'})).toBeNull();
    },
  );

  it('opens the 출력 menu and turns the audience group off with the keyboard', async () => {
    const send = outputSender();
    render(<MenuBar title="" />);
    screen.getByRole('menuitem', {name: '출력'}).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', {name: '출력'})).toBeDefined();
    await userEvent.keyboard('{Enter}');
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'live.batch',
      commands: [{type: 'output.set', screenId: 'main', on: false}],
    });
  });
});
