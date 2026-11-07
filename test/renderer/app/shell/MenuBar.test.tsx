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
import {
  BROADCAST_SCREEN,
  MAIN_SCREEN,
  STAGE_SCREEN,
} from '@fixtures/core/screenIds';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useLive.setState({
    state: {
      ...emptyLiveState(),
      outputs: {[MAIN_SCREEN]: true, [STAGE_SCREEN]: false},
    },
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
    expect(screen.queryByRole('menuitem', {name: /문제 보기/})).toBeNull();
  });

  it.each([
    {name: '청중 화면', screenId: MAIN_SCREEN, on: false},
    {name: '무대 화면', screenId: STAGE_SCREEN, on: true},
    {name: '방송 화면', screenId: BROADCAST_SCREEN, on: true},
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
      commands: [{type: 'output.set', screenId: MAIN_SCREEN, on: false}],
    });
  });
});
