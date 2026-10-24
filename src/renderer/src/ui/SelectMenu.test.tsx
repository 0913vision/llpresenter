import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {SelectMenu, type SelectOption} from './SelectMenu';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

type Interval = 'one' | 'five' | 'off';

const intervals: ReadonlyArray<SelectOption<Interval>> = [
  {value: 'one', label: '1분마다'},
  {value: 'five', label: '5분마다'},
  {value: 'off', label: '끄기', disabled: true},
];

function Autosave({
  onChange = () => {},
}: {
  readonly onChange?: (value: Interval) => void;
}): JSX.Element {
  const [value, setValue] = useState<Interval>('one');
  return (
    <SelectMenu
      aria-label="자동 백업"
      options={intervals}
      value={value}
      onChange={next => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function trigger(): HTMLElement {
  return screen.getByRole('button', {name: '자동 백업'});
}

describe('SelectMenu', () => {
  it('shows the current choice on the button', () => {
    render(<Autosave />);
    expect(trigger().textContent).toBe('1분마다');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a list with a check mark before the current choice', async () => {
    render(<Autosave />);
    await userEvent.click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', {name: '자동 백업'})).toBeDefined();
    expect(
      screen
        .getByRole('menuitemradio', {name: '1분마다'})
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('chooses, closes, and gives focus back to the button', async () => {
    const onChange = vi.fn();
    render(<Autosave onChange={onChange} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('menuitemradio', {name: '5분마다'}));
    expect(onChange).toHaveBeenCalledWith('five');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger().textContent).toBe('5분마다');
    expect(document.activeElement).toBe(trigger());
  });

  it('opens with the down arrow and closes with Esc without choosing', async () => {
    const onChange = vi.fn();
    render(<Autosave onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu')).toBeDefined();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
  });

  it('writes 없음 when nothing is chosen', () => {
    render(
      <SelectMenu
        aria-label="시작할 때"
        options={intervals}
        value={undefined}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', {name: '시작할 때'}).textContent).toBe(
      '없음',
    );
  });
});
