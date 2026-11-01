import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {type JSX, type ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useShowKeys} from '@renderer/features/presentation/shortcuts';
import {useClearKeys} from '@renderer/features/presentation/clearKeys';
import {useUiZoomKeys} from '@renderer/app/shell/uiZoomKeys';
import {CheckRow} from '@renderer/ui/Checkbox';
import {SwitchRow} from '@renderer/ui/Switch';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';

afterEach(() => {
  resetTooltips();
  delete window.llp;
});

function ShowFrame({children}: {readonly children: ReactNode}): JSX.Element {
  useShowKeys();
  useClearKeys();
  useUiZoomKeys();
  return <>{children}</>;
}

describe.each([
  ['CheckRow', 'checkbox', CheckRow],
  ['SwitchRow', 'switch', SwitchRow],
] as const)('Show focus integration audit: %s', (_name, role, Row) => {
  it('keeps focus when a label press releases over its control', async () => {
    const onChange = vi.fn();
    render(
      <ShowFrame>
        <button>이전</button>
        <Row label="이름표" checked={false} onChange={onChange} />
      </ShowFrame>,
    );
    const previous = screen.getByRole('button', {name: '이전'});
    previous.focus();
    await userEvent.pointer([
      {keys: '[MouseLeft>]', target: screen.getByText('이름표')},
      {keys: '[/MouseLeft]', target: screen.getByRole(role)},
    ]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(document.activeElement).toBe(previous);
  });

  it('keeps the native label focus in Prep', async () => {
    render(<Row label="이름표" checked={false} onChange={vi.fn()} />);
    await userEvent.click(screen.getByText('이름표'));
    expect(document.activeElement).toBe(screen.getByRole(role));
  });
});
