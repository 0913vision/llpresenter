import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {Switch, SwitchRow} from './Switch';

function AlwaysOnTop({
  onChange = () => {},
  disabled = false,
}: {
  readonly onChange?: (checked: boolean) => void;
  readonly disabled?: boolean;
}): JSX.Element {
  const [checked, setChecked] = useState(false);
  return (
    <SwitchRow
      label="항상 위"
      checked={checked}
      disabled={disabled}
      onChange={next => {
        setChecked(next);
        onChange(next);
      }}
    />
  );
}

function toggle(): HTMLElement {
  return screen.getByRole('switch', {name: '항상 위'});
}

describe('Switch', () => {
  it('reports its state through aria-checked', () => {
    const {rerender} = render(
      <Switch aria-label="절전 막기" checked={false} onChange={() => {}} />,
    );
    const element = screen.getByRole('switch', {name: '절전 막기'});
    expect(element.getAttribute('aria-checked')).toBe('false');
    rerender(<Switch aria-label="절전 막기" checked onChange={() => {}} />);
    expect(element.getAttribute('aria-checked')).toBe('true');
  });

  it('toggles with Space but not with Enter or the arrows', async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="절전 막기" checked onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}{ArrowLeft}{ArrowRight}');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe('SwitchRow', () => {
  it('is named by its label and toggles from a press on it', async () => {
    const onChange = vi.fn();
    render(<AlwaysOnTop onChange={onChange} />);
    await userEvent.click(screen.getByText('항상 위'));
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    await userEvent.click(toggle());
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it('stays focusable but ignores presses while disabled', async () => {
    const onChange = vi.fn();
    render(<AlwaysOnTop onChange={onChange} disabled />);
    expect(toggle().getAttribute('aria-disabled')).toBe('true');
    await userEvent.tab();
    expect(document.activeElement).toBe(toggle());
    await userEvent.keyboard(' ');
    await userEvent.click(screen.getByText('항상 위'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
