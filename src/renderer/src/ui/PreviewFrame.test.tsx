import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useEffect, useState, type JSX, type ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  PreviewFrame,
  previewReason,
  smallPreviewName,
  type PreviewScreen,
} from './PreviewFrame';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

type ScreenName = 'main' | 'stage' | 'broadcast';

const main: PreviewScreen<ScreenName> = {
  id: 'main',
  name: '본 화면',
  target: {kind: 'display', label: '모니터 2'},
  look: '기본',
  status: {kind: 'on'},
};
const stage: PreviewScreen<ScreenName> = {
  id: 'stage',
  name: '무대 화면',
  target: {kind: 'display', label: '모니터 3'},
  look: '현재와 다음',
  status: {
    kind: 'warning',
    reason: '모니터 3 연결 끊김',
    detail: '창으로 표시 중',
  },
};
const broadcast: PreviewScreen<ScreenName> = {
  id: 'broadcast',
  name: '방송 자막',
  target: {kind: 'ndi', label: 'NDI'},
  look: '하단 자막',
  status: {kind: 'off'},
  chroma: true,
};
const screens = [main, stage, broadcast];

function Preview({
  onBigChange = () => {},
  renderScreen = shown => <span>{`${shown.name} 출력`}</span>,
}: {
  readonly onBigChange?: (id: ScreenName) => void;
  readonly renderScreen?: (shown: PreviewScreen<ScreenName>) => ReactNode;
}): JSX.Element {
  const [big, setBig] = useState<ScreenName>('main');
  return (
    <PreviewFrame
      screens={screens}
      big={big}
      onBigChange={id => {
        setBig(id);
        onBigChange(id);
      }}
      renderScreen={renderScreen}
    />
  );
}

function smallNames(): Array<string | null> {
  return screen
    .getAllByRole('button')
    .map(button => button.getAttribute('aria-label'));
}

describe('PreviewFrame', () => {
  it('shows one picture per screen and a selected marker in the fixed three-slot row', () => {
    const {container} = render(<Preview />);
    expect(screen.getByText('본 화면 출력')).toBeDefined();
    expect(screen.getByText('기본')).toBeDefined();
    expect(smallNames()).toEqual([
      '본 화면 크게 보기',
      '무대 화면 크게 보기, 모니터 3 연결 끊김',
      '방송 자막 크게 보기, 출력이 꺼져 있습니다',
    ]);
    expect(screen.queryByText('현재와 다음')).toBe(null);
    expect(container.querySelectorAll('[data-screen]')).toHaveLength(3);
    const selected = screen.getByRole('button', {pressed: true});
    expect(selected.dataset['previewSlot']).toBe('main');
    expect(
      selected.querySelector('[data-selected-marker="main"]'),
    ).not.toBeNull();
    expect(selected.textContent).toBe('본 화면');
    expect(selected.querySelector('[data-screen]')).toBeNull();
    expect(screen.getAllByText(/출력$/)).toHaveLength(3);
  });

  it('selects a screen on click and keeps every slot in its original order', async () => {
    const onBigChange = vi.fn<(id: ScreenName) => void>();
    render(<Preview onBigChange={onBigChange} />);
    await userEvent.click(
      screen.getByRole('button', {
        name: '무대 화면 크게 보기, 모니터 3 연결 끊김',
      }),
    );
    expect(onBigChange).toHaveBeenCalledWith('stage');
    expect(screen.getByText('현재와 다음')).toBeDefined();
    expect(smallNames()).toEqual([
      '본 화면 크게 보기',
      '무대 화면 크게 보기, 모니터 3 연결 끊김',
      '방송 자막 크게 보기, 출력이 꺼져 있습니다',
    ]);
    expect(
      screen.getByRole('button', {pressed: true}).dataset['previewSlot'],
    ).toBe('stage');
    expect(screen.queryByText('모니터 2')).toBeNull();
    expect(screen.queryByText('NDI')).toBeNull();
  });

  it('keeps all three slots in keyboard order and exposes selection as pressed', async () => {
    const user = userEvent.setup();
    render(<Preview />);
    const buttons = screen.getAllByRole('button');
    await user.tab();
    expect(document.activeElement).toBe(buttons[0]);
    await user.tab();
    expect(document.activeElement).toBe(buttons[1]);
    await user.keyboard('{Enter}');
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('true');
    await user.tab();
    expect(document.activeElement).toBe(buttons[2]);
    await user.keyboard(' ');
    expect(buttons[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('button', {pressed: true})).toHaveLength(1);
  });

  it('keeps every screen mounted in its place across swaps', async () => {
    const lifecycle: string[] = [];
    function Output({name}: {readonly name: string}): JSX.Element {
      useEffect(() => {
        lifecycle.push(`mount ${name}`);
        return () => {
          lifecycle.push(`unmount ${name}`);
        };
      }, [name]);
      return <span>{`${name} 출력`}</span>;
    }
    render(<Preview renderScreen={shown => <Output name={shown.name} />} />);
    const stageOutput = screen.getByText('무대 화면 출력');
    const mainOutput = screen.getByText('본 화면 출력');
    const parents = [stageOutput.parentElement, mainOutput.parentElement];
    lifecycle.length = 0;
    await userEvent.click(
      screen.getByRole('button', {
        name: '무대 화면 크게 보기, 모니터 3 연결 끊김',
      }),
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: '방송 자막 크게 보기, 출력이 꺼져 있습니다',
      }),
    );
    expect(lifecycle).toEqual([]);
    expect(screen.getByText('무대 화면 출력')).toBe(stageOutput);
    expect(screen.getByText('본 화면 출력')).toBe(mainOutput);
    expect([stageOutput.parentElement, mainOutput.parentElement]).toEqual(
      parents,
    );
  });

  it('marks the states and explains them in a tooltip', async () => {
    render(<Preview />);
    const warning = screen.getByRole('button', {
      name: '무대 화면 크게 보기, 모니터 3 연결 끊김',
    });
    expect(warning.closest('[data-state]')?.getAttribute('data-state')).toBe(
      'warning',
    );
    expect((await hoverForTooltip(warning))?.textContent).toBe(
      '모니터 3 연결 끊김, 창으로 표시 중',
    );
    resetTooltips();
    const off = screen.getByRole('button', {
      name: '방송 자막 크게 보기, 출력이 꺼져 있습니다',
    });
    expect(off.closest('[data-state]')?.getAttribute('data-state')).toBe('off');
    expect((await hoverForTooltip(off))?.textContent).toBe(
      '방송 자막 출력이 꺼져 있습니다',
    );
  });

  it('puts a monitor icon before a display target but none before NDI', async () => {
    render(<Preview />);
    const icons = (text: string): number =>
      screen.getByText(text).querySelectorAll('[aria-hidden="true"]').length;
    expect(icons('모니터 2')).toBe(1);
    await userEvent.click(
      screen.getByRole('button', {
        name: '방송 자막 크게 보기, 출력이 꺼져 있습니다',
      }),
    );
    expect(icons('NDI')).toBe(0);
  });

  it('draws the warning icon before the target of a screen in trouble', async () => {
    render(<Preview />);
    await userEvent.click(
      screen.getByRole('button', {
        name: '무대 화면 크게 보기, 모니터 3 연결 끊김',
      }),
    );
    const target = screen.getAllByText('모니터 3')[0];
    expect(target?.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });
});

describe('preview texts', () => {
  it('writes no reason while the output is on', () => {
    expect(previewReason(main)).toBe(undefined);
    expect(smallPreviewName(main)).toBe('본 화면 크게 보기');
  });

  it('writes a warning without a detail as its reason alone', () => {
    const lost: PreviewScreen<ScreenName> = {
      ...stage,
      status: {kind: 'warning', reason: '모니터 3 연결 끊김'},
    };
    expect(previewReason(lost)).toBe('모니터 3 연결 끊김');
  });
});
