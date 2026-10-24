import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  SegmentedControl,
  type SegmentOption,
  type SegmentedKind,
} from './SegmentedControl';

afterEach(cleanup);

type Arrangement = 'base' | 'sunday' | 'short';

const arrangements: readonly SegmentOption<Arrangement>[] = [
  {value: 'base', label: '기본'},
  {value: 'sunday', label: '주일용'},
  {value: 'short', label: '짧게'},
];

function Controlled({
  options = arrangements,
  onChange = () => {},
  disabled = false,
}: {
  readonly options?: readonly SegmentOption<Arrangement>[];
  readonly onChange?: (value: Arrangement) => void;
  readonly disabled?: boolean;
}): JSX.Element {
  const [value, setValue] = useState<Arrangement>('base');
  return (
    <SegmentedControl
      label="구성"
      options={options}
      value={value}
      disabled={disabled}
      onChange={next => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function checkedNames(): string[] {
  return screen
    .getAllByRole('radio')
    .filter(radio => radio.getAttribute('aria-checked') === 'true')
    .map(radio => radio.textContent ?? '');
}

describe('SegmentedControl', () => {
  it('is a named radio group with the selected segment checked', () => {
    render(<Controlled />);
    expect(screen.getByRole('radiogroup', {name: '구성'})).toBeDefined();
    expect(checkedNames()).toEqual(['기본']);
  });

  it.each<[SegmentedKind, string, string, string]>([
    ['tabs', 'tablist', 'tab', 'aria-selected'],
    ['toggle', 'group', 'button', 'aria-pressed'],
  ])(
    'uses the %s roles and state attribute',
    (kind, groupRole, itemRole, stateAttribute) => {
      render(
        <SegmentedControl
          label="보기"
          kind={kind}
          options={arrangements}
          value="sunday"
          onChange={() => {}}
        />,
      );
      expect(screen.getByRole(groupRole, {name: '보기'})).toBeDefined();
      const selected = screen.getByRole(itemRole, {name: '주일용'});
      expect(selected.getAttribute(stateAttribute)).toBe('true');
    },
  );

  it('selects on click and ignores a click on the selected segment', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', {name: '기본'}));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', {name: '짧게'}));
    expect(onChange).toHaveBeenCalledWith('short');
    expect(checkedNames()).toEqual(['짧게']);
  });

  it('puts the only Tab stop on the selected segment', async () => {
    render(<Controlled />);
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('radio', {name: '기본'}),
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(document.body);
  });

  it('moves and selects with the arrow keys, wrapping at the ends', async () => {
    render(<Controlled />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(checkedNames()).toEqual(['주일용']);
    expect(document.activeElement?.textContent).toBe('주일용');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(checkedNames()).toEqual(['짧게']);
    await userEvent.keyboard('{Home}');
    expect(checkedNames()).toEqual(['기본']);
    await userEvent.keyboard('{End}');
    expect(checkedNames()).toEqual(['짧게']);
  });

  it('skips a disabled segment and ignores clicks on it', async () => {
    const onChange = vi.fn();
    render(
      <Controlled
        onChange={onChange}
        options={[
          {value: 'base', label: '기본'},
          {value: 'sunday', label: '주일용', disabled: true, title: '이유'},
          {value: 'short', label: '짧게'},
        ]}
      />,
    );
    const disabled = screen.getByRole('radio', {name: '주일용'});
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(disabled.getAttribute('title')).toBe('이유');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('short');
    await userEvent.click(disabled);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks and keys while the whole group is disabled', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} disabled />);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.getAttribute('aria-disabled')).toBe('true');
    }
    await userEvent.click(screen.getByRole('radio', {name: '짧게'}));
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{End}');
    expect(onChange).not.toHaveBeenCalled();
    expect(checkedNames()).toEqual(['기본']);
  });

  it('names icon segments by their label and shows counts after names', () => {
    const {rerender} = render(
      <SegmentedControl
        label="보기"
        kind="toggle"
        value="grid"
        onChange={() => {}}
        options={[
          {value: 'grid', icon: 'grid', label: '격자 보기'},
          {value: 'list', icon: 'rows', label: '목록 보기'},
        ]}
      />,
    );
    const grid = screen.getByRole('button', {name: '격자 보기'});
    expect(grid.getAttribute('title')).toBe('격자 보기');

    rerender(
      <SegmentedControl
        label="보기"
        value="all"
        onChange={() => {}}
        options={[
          {value: 'all', label: '전체'},
          {value: 'conflict', label: '겹침', count: 1, warning: true},
        ]}
      />,
    );
    expect(screen.getByRole('radio', {name: '겹침 1'})).toBeDefined();
  });

  it('can be named by a visible label', () => {
    render(
      <>
        <span id="mode-label">방식</span>
        <SegmentedControl
          labelledBy="mode-label"
          fill
          options={arrangements}
          value="base"
          onChange={() => {}}
        />
      </>,
    );
    expect(screen.getByRole('radiogroup', {name: '방식'})).toBeDefined();
  });
});
