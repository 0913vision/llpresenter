import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useEffect, useState, type JSX, type ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  PreviewFrame,
  previewReason,
  smallPreviewName,
  type PreviewScreen,
} from '@renderer/ui/PreviewFrame';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';

afterEach(resetTooltips);

type ScreenName = 'main' | 'stage' | 'broadcast';

const main: PreviewScreen<ScreenName> = {
  id: 'main',
  name: '청중 화면',
  target: {kind: 'display', label: '모니터 2'},
  status: {kind: 'on'},
};
const stage: PreviewScreen<ScreenName> = {
  id: 'stage',
  name: '무대 화면',
  target: {kind: 'display', label: '모니터 3'},
  status: {
    kind: 'warning',
    reason: '모니터 3 연결 끊김',
    detail: '창으로 표시 중',
  },
};
const broadcast: PreviewScreen<ScreenName> = {
  id: 'broadcast',
  name: '방송 화면',
  target: {kind: 'ndi', label: 'NDI'},
  status: {kind: 'off'},
  chroma: true,
};
const screens = [main, stage, broadcast];

function Preview({
  sizing = 'fill',
  onBigChange = () => {},
  renderScreen = shown => <span>{`${shown.name} 출력`}</span>,
}: {
  readonly sizing?: 'fill' | 'content';
  readonly onBigChange?: (id: ScreenName) => void;
  readonly renderScreen?: (shown: PreviewScreen<ScreenName>) => ReactNode;
}): JSX.Element {
  const [big, setBig] = useState<ScreenName>('main');
  return (
    <PreviewFrame
      sizing={sizing}
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
  it('does not switch previews on modified keyboard activation', () => {
    const onBigChange = vi.fn();
    render(<Preview onBigChange={onBigChange} />);
    const target = screen.getByRole('button', {
      name: '무대 화면 크게 보기, 모니터 3 연결 끊김',
    });
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      for (const key of [' ', 'Enter']) {
        fireEvent.keyDown(target, {key, [modifier]: true});
        fireEvent.keyUp(target, {key});
        fireEvent.click(target, {detail: 0});
      }
    }
    expect(onBigChange).not.toHaveBeenCalled();
    expect(target.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(target, {detail: 1, ctrlKey: true});
    expect(onBigChange).toHaveBeenCalledExactlyOnceWith('stage');
  });

  it('shows one picture per screen and a selected marker in the fixed three-slot row', () => {
    const {container} = render(<Preview />);
    expect(screen.getByText('청중 화면 출력')).toBeDefined();
    expect(smallNames()).toEqual([
      '청중 화면 크게 보기',
      '무대 화면 크게 보기, 모니터 3 연결 끊김',
      '방송 화면 크게 보기, 출력이 꺼져 있습니다',
    ]);
    expect(container.querySelectorAll('[data-screen]')).toHaveLength(3);
    const selected = screen.getByRole('button', {pressed: true});
    expect(selected.dataset['previewSlot']).toBe('main');
    expect(
      selected.querySelector('[data-selected-marker="main"]'),
    ).not.toBeNull();
    expect(selected.textContent).toBe('청중 화면');
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
    expect(smallNames()).toEqual([
      '청중 화면 크게 보기',
      '무대 화면 크게 보기, 모니터 3 연결 끊김',
      '방송 화면 크게 보기, 출력이 꺼져 있습니다',
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

  it.each(['fill', 'content'] as const)(
    'keeps every screen mounted across swaps with %s sizing',
    async sizing => {
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
      render(
        <Preview
          sizing={sizing}
          renderScreen={shown => <Output name={shown.name} />}
        />,
      );
      const stageOutput = screen.getByText('무대 화면 출력');
      const mainOutput = screen.getByText('청중 화면 출력');
      const parents = [stageOutput.parentElement, mainOutput.parentElement];
      lifecycle.length = 0;
      await userEvent.click(
        screen.getByRole('button', {
          name: '무대 화면 크게 보기, 모니터 3 연결 끊김',
        }),
      );
      await userEvent.click(
        screen.getByRole('button', {
          name: '방송 화면 크게 보기, 출력이 꺼져 있습니다',
        }),
      );
      expect(lifecycle).toEqual([]);
      expect(screen.getByText('무대 화면 출력')).toBe(stageOutput);
      expect(screen.getByText('청중 화면 출력')).toBe(mainOutput);
      expect([stageOutput.parentElement, mainOutput.parentElement]).toEqual(
        parents,
      );
    },
  );

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
      name: '방송 화면 크게 보기, 출력이 꺼져 있습니다',
    });
    expect(off.closest('[data-state]')?.getAttribute('data-state')).toBe('off');
    expect((await hoverForTooltip(off))?.textContent).toBe(
      '방송 화면 출력이 꺼져 있습니다',
    );
  });
});

describe('preview texts', () => {
  it('writes no reason while the output is on', () => {
    expect(previewReason(main)).toBe(undefined);
    expect(smallPreviewName(main)).toBe('청중 화면 크게 보기');
  });

  it('writes a warning without a detail as its reason alone', () => {
    const lost: PreviewScreen<ScreenName> = {
      ...stage,
      status: {kind: 'warning', reason: '모니터 3 연결 끊김'},
    };
    expect(previewReason(lost)).toBe('모니터 3 연결 끊김');
  });
});
