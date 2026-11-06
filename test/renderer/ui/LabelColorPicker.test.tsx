import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {LabelColor} from '@core/labels/colors';
import {
  LabelColorPicker,
  MacroColorPicker,
  paletteColorScopes,
} from '@renderer/ui/LabelColorPicker';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';

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
      scope={paletteColorScopes.label}
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

  it('adds shared scope without replacing the color name or selecting it', async () => {
    const onChange = vi.fn();
    render(
      <LabelColorPicker
        label="후렴 색"
        scope={paletteColorScopes.label}
        value="#D6B35F"
        onChange={onChange}
      />,
    );
    const color = screen.getByRole('radio', {name: '남색'});
    const tooltip = await hoverForTooltip(color);
    expect(tooltip?.textContent).toBe(`남색${paletteColorScopes.label}`);
    expect(color.getAttribute('aria-describedby')).toBe(tooltip?.id);
    expect(onChange).not.toHaveBeenCalled();
    expect(checkedColor()).toBe('노랑');
  });
});

describe('MacroColorPicker', () => {
  it('offers the eight colors without 없음, after a visible name', () => {
    render(
      <MacroColorPicker
        label="색"
        scope={paletteColorScopes.macro}
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
    <MacroColorPicker
      label="Color"
      scope={paletteColorScopes.macro}
      value="teal"
      disabled
      onChange={change}
    />,
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
        scope={paletteColorScopes.macro}
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

  it.each([
    ['이름표', paletteColorScopes.label, '이 이름표를 쓰는 모든 곡에 적용'],
    ['매크로', paletteColorScopes.macro, '이 매크로에 적용'],
  ])(
    'says what a %s color applies to in each swatch tooltip',
    async (_name, scope, text) => {
      render(
        <MacroColorPicker
          label="색"
          scope={scope}
          value="teal"
          onChange={() => undefined}
        />,
      );

      const tooltip = await hoverForTooltip(
        screen.getByRole('radio', {name: '보라'}),
      );

      expect(tooltip?.textContent).toContain('보라');
      expect(tooltip?.textContent).toContain(text);
    },
  );
});
