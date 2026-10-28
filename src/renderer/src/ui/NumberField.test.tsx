import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {NumberField, type NumberFieldProps} from './NumberField';

function Copies({
  onChange = () => {},
  suffix,
  updateOn,
}: {
  readonly onChange?: (value: number) => void;
  readonly suffix?: string;
  readonly updateOn?: 'change' | 'commit';
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
        updateOn={updateOn}
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

function DecimalField({
  initial,
  onChange,
  min = -2,
  max = 2,
  ...props
}: Pick<NumberFieldProps, 'step' | 'largeStep' | 'updateOn' | 'suffix'> & {
  readonly initial: number;
  readonly onChange?: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
}): JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberField
        {...props}
        aria-label="복구 사본"
        min={min}
        max={max}
        value={value}
        onChange={next => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <button type="button">다음</button>
    </>
  );
}

describe('NumberField', () => {
  it('defers typing and rounds to the default whole step on Enter', async () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} updateOn="commit" />);
    await userEvent.clear(spin());
    await userEvent.type(spin(), '25.6');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(26);
  });

  it.each([
    {initial: 0.2, step: 0.1, suffix: '', text: '0.2'},
    {initial: 1.4, step: 0.05, suffix: '', text: '1.40'},
    {initial: 1, step: 0.05, suffix: '×', text: '1.00×'},
    {initial: 1, step: 1, suffix: '%', text: '1%'},
  ])('formats step $step as $text', ({initial, step, suffix, text}) => {
    render(<DecimalField initial={initial} step={step} suffix={suffix} />);
    expect(spin().value).toBe(text);
    expect(spin().getAttribute('aria-valuetext')).toBe(text);
  });

  it('moves repeatedly in decimal steps without accumulating float drift', async () => {
    const onChange = vi.fn<(value: number) => void>();
    render(<DecimalField initial={0.2} step={0.1} onChange={onChange} />);
    spin().focus();
    await userEvent.keyboard('{ArrowUp}'.repeat(7));
    expect(spin().value).toBe('0.9');
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    ]);
    await userEvent.keyboard('{ArrowDown}'.repeat(7));
    expect(spin().value).toBe('0.2');
  });

  it.each([
    {ctrlKey: true},
    {altKey: true},
    {metaKey: true},
    {ctrlKey: true, shiftKey: true},
  ])('leaves modified arrow keys to their owner: %j', modifiers => {
    const onChange = vi.fn();
    render(<DecimalField initial={0.2} step={0.1} onChange={onChange} />);
    for (const key of ['ArrowUp', 'ArrowDown']) {
      const event = new KeyboardEvent('keydown', {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
        ...modifiers,
      });
      fireEvent(spin(), event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(spin().value).toBe('0.2');
  });

  it.each([
    [undefined, '1.90'],
    [0.2, '1.60'],
  ])(
    'uses largeStep %s with Shift from a small-step value',
    async (largeStep, text) => {
      render(<DecimalField initial={1.4} step={0.05} largeStep={largeStep} />);
      spin().focus();
      await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
      expect(spin().value).toBe(text);
    },
  );

  it.each([
    {
      initial: 1,
      step: 0.1,
      largeStep: 0.25,
      key: 'ArrowUp',
      expected: 1.25,
      text: '1.25',
    },
    {
      initial: 1,
      step: 0.1,
      largeStep: 0.25,
      key: 'ArrowDown',
      expected: 0.75,
      text: '0.75',
    },
    {
      initial: 0.7,
      step: 0.07,
      largeStep: undefined,
      key: 'ArrowUp',
      expected: 1.4,
      text: '1.40',
    },
  ])(
    'keeps increment precision for step $step and largeStep $largeStep with $key',
    async ({initial, step, largeStep, key, expected, text}) => {
      const onChange = vi.fn();
      render(
        <DecimalField
          initial={initial}
          step={step}
          largeStep={largeStep}
          onChange={onChange}
        />,
      );
      spin().focus();
      await userEvent.keyboard(`{Shift>}{${key}}{/Shift}`);
      expect(onChange).toHaveBeenCalledExactlyOnceWith(expected);
      expect(spin().value).toBe(text);
      expect(spin().getAttribute('aria-valuenow')).toBe(String(expected));
      expect(spin().getAttribute('aria-valuetext')).toBe(text);
    },
  );

  it('steps from the nearest whole step rather than retaining an offset', async () => {
    render(<DecimalField initial={0.26} step={0.1} />);
    spin().focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(spin().value).toBe('0.4');
  });

  it.each([
    {
      initial: 0.28,
      min: 0,
      max: 0.28,
      inward: '{ArrowDown}',
      outward: '{ArrowUp}',
      expected: 0.2,
    },
    {
      initial: 0.12,
      min: 0.12,
      max: 1,
      inward: '{ArrowUp}',
      outward: '{ArrowDown}',
      expected: 0.2,
    },
    {
      initial: 0.28,
      min: 0,
      max: 0.28,
      inward: '{Shift>}{ArrowDown}{/Shift}',
      outward: '{Shift>}{ArrowUp}{/Shift}',
      expected: 0.1,
    },
    {
      initial: 0.12,
      min: 0.12,
      max: 1,
      inward: '{Shift>}{ArrowUp}{/Shift}',
      outward: '{Shift>}{ArrowDown}{/Shift}',
      expected: 0.3,
    },
  ])(
    'moves from off-grid bound $initial to $expected with $inward',
    async ({initial, min, max, inward, outward, expected}) => {
      const onChange = vi.fn();
      render(
        <DecimalField
          initial={initial}
          min={min}
          max={max}
          step={0.1}
          largeStep={0.2}
          onChange={onChange}
        />,
      );
      spin().focus();
      await userEvent.keyboard(outward);
      expect(onChange).not.toHaveBeenCalled();
      expect(spin().value).toBe(String(initial));
      await userEvent.keyboard(inward);
      expect(onChange).toHaveBeenCalledExactlyOnceWith(expected);
      expect(spin().value).toBe(String(expected));
      expect(spin().getAttribute('aria-valuenow')).toBe(String(expected));
      expect(spin().getAttribute('aria-valuetext')).toBe(String(expected));
      await userEvent.keyboard(outward);
      expect(onChange).toHaveBeenLastCalledWith(initial);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(spin().value).toBe(String(initial));
    },
  );

  it.each(['Enter', 'Tab'])(
    'rounds deferred decimal typing once on %s',
    async key => {
      const onChange = vi.fn();
      render(
        <DecimalField
          initial={0.2}
          step={0.1}
          updateOn="commit"
          onChange={onChange}
        />,
      );
      await userEvent.clear(spin());
      await userEvent.type(spin(), '0.26');
      expect(onChange).not.toHaveBeenCalled();
      await userEvent.keyboard(`{${key}}`);
      expect(spin().value).toBe('0.3');
      expect(onChange).toHaveBeenCalledExactlyOnceWith(0.3);
      if (key === 'Enter') await userEvent.tab();
      expect(onChange).toHaveBeenCalledOnce();
    },
  );

  it('rounds immediate typing at blur and keeps its padded precision', async () => {
    const onChange = vi.fn();
    render(<DecimalField initial={1.4} step={0.05} onChange={onChange} />);
    await userEvent.clear(spin());
    await userEvent.type(spin(), '1.43');
    expect(onChange).toHaveBeenLastCalledWith(1.43);
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(1.45);
    expect(spin().value).toBe('1.45');
  });

  it.each([
    {key: 'Enter', min: 0, max: 0.28, typed: '0.27', bound: 0.28, suffix: ''},
    {key: 'Tab', min: 0, max: 0.28, typed: '0.27', bound: 0.28, suffix: ''},
    {key: 'Enter', min: 0.12, max: 1, typed: '0.13', bound: 0.12, suffix: '×'},
    {key: 'Tab', min: 0.12, max: 1, typed: '0.13', bound: 0.12, suffix: '×'},
  ])(
    'shows the actual off-grid bound $bound after committing on $key',
    async ({key, min, max, typed, bound, suffix}) => {
      const onChange = vi.fn();
      render(
        <DecimalField
          initial={0.2}
          step={0.1}
          min={min}
          max={max}
          suffix={suffix}
          updateOn="commit"
          onChange={onChange}
        />,
      );
      await userEvent.clear(spin());
      await userEvent.type(spin(), typed);
      await userEvent.keyboard(`{${key}}`);
      expect(onChange).toHaveBeenCalledExactlyOnceWith(bound);
      expect(spin().value).toBe(`${bound}${suffix}`);
      expect(spin().getAttribute('aria-valuenow')).toBe(String(bound));
      expect(spin().getAttribute('aria-valuetext')).toBe(`${bound}${suffix}`);
    },
  );

  it('passes modified Enter and Escape without finishing a commit-mode draft', () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} updateOn="commit" />);
    fireEvent.change(spin(), {target: {value: '25'}});
    const keys = vi.fn();
    window.addEventListener('keydown', keys);
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      for (const key of ['Enter', 'Escape']) {
        expect(fireEvent.keyDown(spin(), {key, [modifier]: true})).toBe(true);
      }
    }
    window.removeEventListener('keydown', keys);
    expect(keys).toHaveBeenCalledTimes(8);
    expect(spin().value).toBe('25');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(spin(), {key: 'Enter'});
    expect(onChange).toHaveBeenCalledExactlyOnceWith(25);
  });

  it('cancels a commit-mode draft without reporting it on blur', async () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} updateOn="commit" />);
    await userEvent.clear(spin());
    await userEvent.type(spin(), '25');
    await userEvent.keyboard('{Escape}{Tab}');
    expect(onChange).not.toHaveBeenCalled();
    expect(spin().value).toBe('10');
  });

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

  it('leaves Enter to the IME while input is composed', async () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} />);
    await userEvent.tripleClick(spin());
    await userEvent.keyboard('0');
    fireEvent.keyDown(spin(), {key: 'Enter', isComposing: true});
    expect(spin().value).toBe('0');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows an attached suffix and reads values with it', async () => {
    const onChange = vi.fn();
    render(<Copies onChange={onChange} suffix="%" />);
    expect(spin().value).toBe('10%');
    await userEvent.tripleClick(spin());
    await userEvent.keyboard('30%');
    expect(onChange).toHaveBeenLastCalledWith(30);
  });

  it('keeps a read-only value on the arrow keys and Enter', async () => {
    const onChange = vi.fn();
    render(
      <NumberField
        aria-label="복구 사본"
        min={1}
        max={50}
        value={10}
        readOnly
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('spinbutton', {name: '복구 사본'}));
    await userEvent.keyboard('{ArrowUp}{Shift>}{ArrowDown}{/Shift}{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });
});
