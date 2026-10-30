import {cleanup, fireEvent, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {useLive} from '@renderer/platform/live';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {MenuBar} from './MenuBar';
import {renderWithScreenSummaries as render} from '@renderer/app/shell/testing/screenSummaries';

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
  window.llp = fakeLlpApi({live: {send}});
  return send;
}

function outputItem(name: string): HTMLElement {
  return name === '방송 자막'
    ? screen.getByRole('menuitemcheckbox', {name: '방송 자막 켜기'})
    : within(screen.getByRole('group', {name})).getByRole('menuitem', {
        name: /^출력/,
      });
}

describe('MenuBar', () => {
  it.each(['파일', '보기', '출력', '최소화', '최대화', '닫기'])(
    'does not activate %s on modified keyboard presses',
    label => {
      const control = vi.fn();
      window.llp = fakeLlpApi({window: {control}});
      render(<MenuBar title="" clipboardAvailable={async () => false} />);
      const target = screen.getByRole(
        ['파일', '보기', '출력'].includes(label) ? 'menuitem' : 'button',
        {name: label},
      );
      for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
        for (const key of [' ', 'Enter']) {
          fireEvent.keyDown(target, {key, [modifier]: true});
          fireEvent.keyUp(target, {key});
          fireEvent.click(target, {detail: 0});
          expect(screen.queryByRole('menu')).toBeNull();
          expect(control).not.toHaveBeenCalled();
        }
      }
    },
  );

  it('still accepts modified pointer presses on window controls', () => {
    const control = vi.fn();
    window.llp = fakeLlpApi({window: {control}});
    render(<MenuBar title="" />);
    fireEvent.click(screen.getByRole('button', {name: '최대화'}), {
      detail: 1,
      ctrlKey: true,
    });
    expect(control).toHaveBeenCalledExactlyOnceWith('toggle-maximize');
  });

  it.each([
    {label: '텍스트 파일', source: 'file'},
    {label: '클립보드 텍스트', source: 'clipboard'},
  ])('starts $source import from the File submenu', async ({label, source}) => {
    const onImport = vi.fn();
    render(
      <MenuBar
        title=""
        onImportText={onImport}
        clipboardAvailable={async () => true}
      />,
    );
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
    await userEvent.click(
      await screen.findByRole('menuitem', {name: new RegExp(`^${label}`)}),
    );
    expect(onImport).toHaveBeenCalledExactlyOnceWith(source);
    expect(screen.queryByRole('menu', {name: '파일'})).toBeNull();
  });
  it('shows the service name in the center', () => {
    render(<MenuBar title="주일 예배" />);
    expect(screen.getByText('주일 예배')).toBeTruthy();
    expect(screen.queryByText('LoveLight Presenter')).toBeNull();
  });

  it('marks only implemented menu triggers as opening a menu', () => {
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
      if (['편집', '창', '도움말'].includes(item.textContent)) {
        expect(item.getAttribute('aria-disabled')).toBe('true');
        expect(item.hasAttribute('aria-haspopup')).toBe(false);
        expect(item.hasAttribute('aria-expanded')).toBe(false);
      } else {
        expect(item.getAttribute('aria-haspopup')).toBe('menu');
        expect(item.getAttribute('aria-expanded')).toBe('false');
      }
    }
  });

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
    window.llp = fakeLlpApi({window: {control}});
    render(<MenuBar title="" />);
    fireEvent.click(screen.getByRole('button', {name: '최대화'}));
    fireEvent.click(screen.getByRole('button', {name: '닫기'}));
    expect(control.mock.calls).toEqual([['toggle-maximize'], ['close']]);
  });

  it('shows group output commands and only a broadcast checkbox', async () => {
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
    expect(screen.getByRole('menu', {name: '출력'})).toBeDefined();
    expect(outputItem('본 화면').textContent).toBe('출력 끄기');
    expect(outputItem('무대 화면').textContent).toBe('출력 켜기');
    expect(outputItem('방송 자막').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('menuitem', {name: /경고 보기/})).toBeNull();
  });

  it.each([
    {name: '본 화면', screenId: 'main', on: false},
    {name: '무대 화면', screenId: 'stage', on: true},
    {name: '방송 자막', screenId: 'broadcast', on: true},
  ])(
    'turns $name output on=$on with a click and closes the menu',
    async ({name, screenId, on}) => {
      const send = outputSender();
      render(<MenuBar title="" />);
      await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
      await userEvent.click(outputItem(name));
      expect(send).toHaveBeenCalledExactlyOnceWith({
        type: 'live.batch',
        commands: (name === '본 화면' ? ['main', 'broadcast'] : [screenId]).map(
          id => ({type: 'output.set', screenId: id, on}),
        ),
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
      commands: [
        {type: 'output.set', screenId: 'main', on: false},
        {type: 'output.set', screenId: 'broadcast', on: false},
      ],
    });
  });

  it('lists a warning item per screen and shows its card on select', async () => {
    const onShowWarning = vi.fn();
    render(
      <MenuBar
        title=""
        warnings={[{screenId: 'stage', screenName: '무대 화면'}]}
        onShowWarning={onShowWarning}
      />,
    );
    await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
    await userEvent.click(
      screen.getByRole('menuitem', {name: '무대 화면 경고 보기'}),
    );
    expect(onShowWarning).toHaveBeenCalledExactlyOnceWith('stage');
  });
});
