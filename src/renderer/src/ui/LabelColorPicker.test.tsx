import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {LabelColor} from '@shared/colors';
import {LabelColorPicker, MacroColorPicker} from './LabelColorPicker';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

function ChorusColor({
  onChange = () => undefined,
}: {
  readonly onChange?: (color: LabelColor) => void;
}): JSX.Element {
  const [color, setColor] = useState<LabelColor>('yellow');
  return (
    <LabelColorPicker
      label="후렴 색"
      value={color}
      onChange={next => {
        setColor(next);
        onChange(next);
      }}
    />
  );
}

function checkedColor(): string | null {
  return screen.getByRole('radio', {checked: true}).getAttribute('aria-label');
}

describe('LabelColorPicker', () => {
  it('is a named radio group of 없음 and the eight colors in order', () => {
    render(<ChorusColor />);
    expect(screen.getByRole('radiogroup', {name: '후렴 색'})).toBeDefined();
    expect(
      screen
        .getAllByRole('radio')
        .map(radio => radio.getAttribute('aria-label')),
    ).toEqual([
      '없음',
      '청록',
      '초록',
      '노랑',
      '주황',
      '분홍',
      '보라',
      '남색',
      '회색',
    ]);
    expect(checkedColor()).toBe('노랑');
  });

  it('picks a color on click', async () => {
    const onChange = vi.fn();
    render(<ChorusColor onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', {name: '보라'}));
    expect(onChange).toHaveBeenCalledWith('violet');
    expect(checkedColor()).toBe('보라');
  });

  it('enters on the current color and moves with the arrows', async () => {
    render(<ChorusColor />);
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('radio', {name: '노랑'}),
    );
    await userEvent.keyboard('{ArrowRight}');
    expect(checkedColor()).toBe('주황');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(checkedColor()).toBe('초록');
  });

  it('names each color in its tooltip', async () => {
    render(<ChorusColor />);
    const tooltip = await hoverForTooltip(
      screen.getByRole('radio', {name: '남색'}),
    );
    expect(tooltip?.textContent).toBe('남색');
  });
});

describe('MacroColorPicker', () => {
  it('offers the eight colors without 없음, after a visible name', () => {
    render(
      <MacroColorPicker
        label="색"
        name="색"
        inMenu
        value="green"
        onChange={() => undefined}
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    expect(screen.queryByRole('radio', {name: '없음'})).toBeNull();
    expect(screen.getByText('색')).toBeDefined();
  });
});
