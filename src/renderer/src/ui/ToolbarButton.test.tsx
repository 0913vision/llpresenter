import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {OutputToggle, outputTooltip} from './OutputToggle';
import {ToolbarButton} from './ToolbarButton';
import {ToolbarTabs, type ToolbarTab} from './ToolbarTabs';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

type Workspace = 'show' | 'prep' | 'screens';

const workspaceTabs: ReadonlyArray<ToolbarTab<Workspace>> = [
  {value: 'show', icon: 'slides', label: '진행'},
  {value: 'prep', icon: 'edit', label: '준비'},
  {value: 'screens', icon: 'gear', label: '화면 설정'},
];

function Workspaces(): JSX.Element {
  const [workspace, setWorkspace] = useState<Workspace>('show');
  return (
    <ToolbarTabs
      label="작업 공간"
      tabs={workspaceTabs}
      value={workspace}
      onChange={setWorkspace}
    />
  );
}

function selectedTab(): string | null {
  return screen.getByRole('tab', {selected: true}).textContent;
}

describe('ToolbarTabs', () => {
  it('does not switch workspace on modified keyboard activation', () => {
    render(<Workspaces />);
    const target = screen.getByRole('tab', {name: '준비'});
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      for (const key of [' ', 'Enter']) {
        fireEvent.keyDown(target, {key, [modifier]: true});
        fireEvent.keyUp(target, {key});
        fireEvent.click(target, {detail: 0});
      }
    }
    expect(selectedTab()).toBe('진행');
    fireEvent.click(target, {detail: 1, ctrlKey: true});
    expect(selectedTab()).toBe('준비');
  });

  it('is a named tab list with the current workspace selected', () => {
    render(<Workspaces />);
    expect(screen.getByRole('tablist', {name: '작업 공간'})).toBeDefined();
    expect(selectedTab()).toBe('진행');
  });

  it('switches on click and with the arrow keys', async () => {
    render(<Workspaces />);
    await userEvent.click(screen.getByRole('tab', {name: '준비'}));
    expect(selectedTab()).toBe('준비');
    await userEvent.keyboard('{ArrowRight}');
    expect(selectedTab()).toBe('화면 설정');
    await userEvent.keyboard('{ArrowRight}');
    expect(selectedTab()).toBe('진행');
    expect(document.activeElement?.textContent).toBe('진행');
  });

  it('stops Tab only on the selected tab', async () => {
    render(<Workspaces />);
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe('진행');
    await userEvent.tab();
    expect(document.activeElement).toBe(document.body);
  });
});

describe('ToolbarButton', () => {
  it('reports the opposite value on each press of a view toggle', async () => {
    const onPressedChange = vi.fn();
    render(
      <ToolbarButton
        icon="film"
        label="미디어"
        pressed={false}
        title="미디어 열기"
        onPressedChange={onPressedChange}
      />,
    );
    const button = screen.getByRole('button', {name: '미디어'});
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(button);
    expect(onPressedChange).toHaveBeenCalledWith(true);
    await userEvent.unhover(button);
    const tooltip = await hoverForTooltip(button);
    expect(tooltip?.textContent).toBe('미디어 열기');
  });

  it.each([false, true])(
    'keeps the toggle label visible with compact=%s',
    compact => {
      render(
        <ToolbarButton
          icon="film"
          label="미디어"
          compact={compact}
          iconOnly
          pressed={false}
        />,
      );
      const button = screen.getByRole('button', {name: '미디어'});
      expect(button.textContent).toBe('미디어');
      expect(button.hasAttribute('aria-selected')).toBe(false);
    },
  );

  it('shows the name beside the icon in the compact form', () => {
    render(<ToolbarButton icon="layers" label="평상시" compact menu />);
    expect(screen.getByRole('button').textContent).toBe('평상시');
  });

  it('marks a menu button and whether its menu is open', () => {
    render(<ToolbarButton icon="layers" label="평상시" menu expanded />);
    const button = screen.getByRole('button', {name: '평상시'});
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('ignores presses while disabled', async () => {
    const onClick = vi.fn();
    render(
      <ToolbarButton icon="layers" label="평상시" disabled onClick={onClick} />,
    );
    const button = screen.getByRole('button', {name: '평상시'});
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('OutputToggle', () => {
  it.each([
    ['live', 'true', '본 화면 출력 끄기 (모니터 2)'],
    ['off', 'false', '본 화면 출력 켜기 (모니터 2)'],
    ['warning', 'true', '본 화면: 모니터 2를 찾을 수 없습니다'],
  ] as const)(
    'draws the %s state with aria-pressed %s, its dot, and its tooltip',
    async (state, pressed, tooltip) => {
      render(
        <OutputToggle
          icon="mplay"
          label="본 화면"
          target="모니터 2"
          state={state}
          onToggle={() => {}}
        />,
      );
      const button = screen.getByRole('button', {name: '본 화면'});
      expect(button.getAttribute('aria-pressed')).toBe(pressed);
      expect(button.getAttribute('data-state')).toBe(state);
      const dots = button.querySelectorAll('[data-tone]');
      expect([...dots].map(dot => dot.getAttribute('data-tone'))).toEqual([
        state,
      ]);
      expect((await hoverForTooltip(button))?.textContent).toBe(tooltip);
    },
  );

  it('uses the full screen name in the tooltip', async () => {
    render(
      <OutputToggle
        icon="mplay"
        label="무대"
        screenName="무대 화면"
        target="모니터 3"
        state="warning"
        onToggle={() => {}}
      />,
    );
    const button = screen.getByRole('button', {name: '무대'});
    expect((await hoverForTooltip(button))?.textContent).toBe(
      '무대 화면: 모니터 3을 찾을 수 없습니다',
    );
  });

  it('reports a click and ignores it while disabled', async () => {
    const onToggle = vi.fn();
    const {rerender} = render(
      <OutputToggle
        icon="capture"
        label="방송 자막"
        target="NDI"
        state="off"
        onToggle={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(
      <OutputToggle
        icon="capture"
        label="방송 자막"
        target="NDI"
        state="off"
        disabled
        onToggle={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('outputTooltip', () => {
  it('names what a click does for the target', () => {
    expect(
      outputTooltip({screenName: '방송 자막', target: 'NDI', state: 'live'}),
    ).toBe('방송 자막 출력 끄기 (NDI)');
  });
});
