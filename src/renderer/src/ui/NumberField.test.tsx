import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {NumberField} from './NumberField';

function Copies({
  onChange = () => {},
  suffix,
}: {
  readonly onChange?: (value: number) => void;
  readonly suffix?: string;
}): JSX.Element {
  const [value, setValue] = useState(10);
  return (
    <>
      <NumberField
        aria-label="복구 사본"
        min={1}
        max={50}
        unit="개"
        suffix={suffix}
        value={value}
        onChange={next => {
          setValue(next);
          onChange(next);
        }}
      />
      <button type="button">다음</button>
    </>
  );
}

function spin(): HTMLInputElement {
  const input = screen.getByRole('spinbutton', {name: '복구 사본'});
  if (!(input instanceof HTMLInputElement)) throw new Error('No input');
  return input;
}

describe('NumberField', () => {
  it('is a spin button that reports its value and range', () => {
    render(<Copies />);
    expect(spin().value).toBe('10');
    expect(spin().getAttribute('aria-valuenow')).toBe('10');
    expect(spin().getAttribute('aria-valuemin')).toBe('1');
    expect(spin().getAttribute('aria-valuemax')).toBe('50');
    expect(screen.getByText('개')).toBeDefined();
  });

  it('steps by one with the arrows and by ten with Shift', async () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} />);
    await userEvent.click(spin());
    await userEvent.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith(11);
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(onChange).toHaveBeenLastCalledWith(1);
    await userEvent.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('reports a typed value in range at once', async () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} />);
    await userEvent.tripleClick(spin());
    await userEvent.keyboard('25');
    expect(onChange).toHaveBeenLastCalledWith(25);
  });

  it('snaps an out-of-range value into the range when focus leaves', async () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} />);
    await userEvent.tripleClick(spin());
    await userEvent.keyboard('99');
    expect(onChange).not.toHaveBeenCalledWith(99);
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(50);
    expect(spin().value).toBe('50');
  });

  it('goes back to the last value when the text is not a number', async () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} />);
    await userEvent.tripleClick(spin());
    await userEvent.keyboard('{Backspace}');
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(spin().value).toBe('10');
  });

  it('commits a typed value on Enter', async () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} />);
    await userEvent.tripleClick(spin());
    await userEvent.keyboard('0{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(spin().value).toBe('1');
  });

  it('shows an attached suffix and reads values with it', async () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} suffix="%" />);
    expect(spin().value).toBe('10%');
    await userEvent.tripleClick(spin());
    await userEvent.keyboard('30%');
    expect(onChange).toHaveBeenLastCalledWith(30);
  });
});
