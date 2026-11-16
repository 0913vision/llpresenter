import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {
  CheckRow,
  Checkbox,
  nextCheckState,
  type CheckRowProps,
  type CheckState,
} from '@renderer/ui/Checkbox';

function Row({
  initial = false,
  onChange = () => {},
  ...props
}: Partial<CheckRowProps> & {readonly initial?: CheckState}): JSX.Element {
  const [checked, setChecked] = useState<CheckState>(initial);
  return (
    <CheckRow
      label="화면 출력"
      {...props}
      checked={checked}
      onChange={next => {
        setChecked(next);
        onChange(next);
      }}
    />
  );
}

function box(name = '화면 출력'): HTMLElement {
  return screen.getByRole('checkbox', {name});
}

describe('nextCheckState', () => {
  it('turns off and mixed on, and on off', () => {
    expect(nextCheckState(false)).toBe(true);
    expect(nextCheckState('mixed')).toBe(true);
    expect(nextCheckState(true)).toBe(false);
  });
});

describe('Checkbox', () => {
  it('toggles with Space but not with Enter', async () => {
    const onChange = vi.fn();
    render(<Checkbox aria-label="선택" checked={false} onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('CheckRow', () => {
  it('focuses its control when its label is clicked', async () => {
    render(<CheckRow label="이름표" checked={false} onChange={vi.fn()} />);

    await userEvent.click(screen.getByText('이름표'));

    expect(document.activeElement).toBe(screen.getByRole('checkbox'));
  });

  it('toggles from a press on the name or the icon', async () => {
    const {container} = render(<Row icon="mplay" />);
    await userEvent.click(screen.getByText('화면 출력'));
    expect(box().getAttribute('aria-checked')).toBe('true');
    const icon = container.querySelector('label > [aria-hidden="true"]');
    if (icon === null) throw new Error('No icon');
    await userEvent.click(icon);
    expect(box().getAttribute('aria-checked')).toBe('false');
  });

  it('is named by its label and described by its value', () => {
    render(<Row value="청중 화면, 무대 화면, 방송 화면" />);
    expect(
      screen.getByRole('checkbox', {
        name: '화면 출력',
        description: '청중 화면, 무대 화면, 방송 화면',
      }),
    ).toBeDefined();
  });

  it('is described by its extra info', () => {
    render(<Row label="만복의 근원 하나님" meta="주일용" variant="list" />);
    expect(
      screen.getByRole('checkbox', {
        name: '만복의 근원 하나님',
        description: '주일용',
      }),
    ).toBeDefined();
  });

  it('turns a mixed group header on', async () => {
    const onChange = vi.fn();
    render(
      <Row
        label="예배 전"
        variant="group"
        initial="mixed"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByText('예배 전'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('ignores presses while disabled', async () => {
    const onChange = vi.fn();
    render(<Row disabled title="이유" onChange={onChange} />);
    expect(box().getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(screen.getByText('화면 출력'));
    await userEvent.click(box());
    expect(onChange).not.toHaveBeenCalled();
  });
});
