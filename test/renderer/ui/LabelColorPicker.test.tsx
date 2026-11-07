import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {LabelColor} from '@core/labels/colors';
import {
  LabelColorPicker,
  MacroColorPicker,
} from '@renderer/ui/LabelColorPicker';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';

afterEach(resetTooltips);

function ChorusColor({
  onChange = () => undefined,
}: {
  readonly onChange?: (color: LabelColor) => void;
}): JSX.Element {
  const [color, setColor] = useState<LabelColor>('#D6B35F');
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
  it('does not change color on modified keyboard activation', () => {
    const onChange = vi.fn();
    render(<ChorusColor onChange={onChange} />);
    const target = screen.getByRole('radio', {name: '보라'});
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      for (const key of [' ', 'Enter']) {
        fireEvent.keyDown(target, {key, [modifier]: true});
        fireEvent.keyUp(target, {key});
        fireEvent.click(target, {detail: 0});
      }
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(checkedColor()).toBe('노랑');
    fireEvent.click(target, {detail: 1, ctrlKey: true});
    expect(onChange).toHaveBeenCalledExactlyOnceWith('#A99AE0');
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

it('does not apply a macro color while disabled', () => {
  const change = vi.fn();
  render(
    <MacroColorPicker label="Color" value="teal" disabled onChange={change} />,
  );
  fireEvent.click(screen.getByRole('radio', {name: '\ucd08\ub85d'}));
  expect(change).not.toHaveBeenCalled();
});

describe('the palette color control in every place', () => {
  const eight = [
    '청록',
    '초록',
    '노랑',
    '주황',
    '분홍',
    '보라',
    '남색',
    '회색',
  ];

  it('lists 없음 first only for 이름표, then the same eight colors in the same order as 매크로', () => {
    const {unmount} = render(<ChorusColor />);
    const label = screen
      .getAllByRole('radio')
      .map(item => item.getAttribute('aria-label'));
    unmount();
    render(
      <MacroColorPicker
        label="매크로 색"
        value="teal"
        onChange={() => undefined}
      />,
    );
    const macro = screen
      .getAllByRole('radio')
      .map(item => item.getAttribute('aria-label'));

    expect(label).toEqual(['없음', ...eight]);
    expect(macro).toEqual(eight);
  });
});
