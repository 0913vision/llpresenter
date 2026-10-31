import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {IconButton} from './IconButton';
import {ListBox, ListGroup, ListRow} from './ListRow';
import {resetTooltips} from './tooltipTesting';
import {ServiceOrder, selectedTitle} from './testing/listTesting';

afterEach(resetTooltips);

type RowChange = 'remove' | 'disable' | 'enable' | 'insert';

function ChangingRows({change}: {readonly change: RowChange}): JSX.Element {
  const [changed, setChanged] = useState(false);
  const showFirst =
    change === 'remove' ? !changed : change !== 'insert' || changed;
  const disableFirst =
    (change === 'disable' && changed) || (change === 'enable' && !changed);
  return (
    <ListGroup label="찬양">
      {showFirst ? (
        <ListRow value="hymn" title="찬양" disabled={disableFirst} />
      ) : null}
      <ListRow
        value="notice"
        title="광고"
        end={
          <IconButton
            icon="refresh"
            label="목록 변경"
            onClick={() => setChanged(value => !value)}
          />
        }
      />
    </ListGroup>
  );
}

describe('ListBox', () => {
  it('exposes externally controlled multiple selection while retaining the list cursor', () => {
    render(
      <ListBox multiple label="Elements" selected="first" onSelect={vi.fn()}>
        <ListRow value="first" title="First" selected />
        <ListRow value="second" title="Second" selected />
      </ListBox>,
    );
    expect(
      screen.getByRole('listbox').getAttribute('aria-multiselectable'),
    ).toBe('true');
    expect(
      screen
        .getAllByRole('option')
        .every(row => row.getAttribute('aria-selected') === 'true'),
    ).toBe(true);
    expect(screen.getByRole('option', {name: 'First'}).tabIndex).toBe(0);
    expect(screen.getByRole('option', {name: 'Second'}).tabIndex).toBe(-1);
  });

  it('selects empty sections by pointer and keyboard as insertion targets', async () => {
    const onSelect = vi.fn();
    render(
      <ListBox label="예배 순서" selected={undefined} onSelect={onSelect}>
        <ListGroup label="빈 구역" value="empty">
          {null}
        </ListGroup>
        <ListGroup label="다음 구역" value="next">
          <ListRow value="song" title="첫 곡" />
        </ListGroup>
      </ListBox>,
    );
    const empty = screen.getByRole('option', {name: '빈 구역'});
    await userEvent.click(empty);
    expect(onSelect).toHaveBeenLastCalledWith('empty');
    empty.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenLastCalledWith('next');
    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenLastCalledWith('song');
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(empty);
    expect(onSelect).toHaveBeenLastCalledWith('empty');
  });

  it.each(['show', 'prep'] as const)(
    'keeps Tab entry and arrow selection in the %s focus appearance',
    async workspace => {
      const onSelect = vi.fn();
      render(<ServiceOrder workspace={workspace} onSelect={onSelect} />);
      expect(screen.getByRole('listbox').dataset['workspace']).toBe(workspace);
      await userEvent.tab();
      expect(document.activeElement?.getAttribute('data-value')).toBe('count');
      await userEvent.keyboard('{ArrowDown}');
      expect(document.activeElement?.getAttribute('data-value')).toBe('hymn1');
      expect(selectedTitle()).toBe('hymn1');
      expect(onSelect).toHaveBeenCalledWith('hymn1');
    },
  );

  it('is a named list box of named options in named groups', () => {
    render(<ServiceOrder />);
    expect(screen.getByRole('listbox', {name: '예배 순서'})).toBeDefined();
    expect(screen.getByRole('group', {name: '찬양'})).toBeDefined();
    expect(
      screen.getByRole('option', {name: '만복의 근원 하나님'}),
    ).toBeDefined();
  });

  it('moves and selects with the arrows, skipping disabled rows', async () => {
    render(<ServiceOrder initial="count" />);
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('data-value')).toBe('count');
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedTitle()).toBe('hymn1');
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedTitle()).toBe('hymn3');
    await userEvent.keyboard('{Home}');
    expect(selectedTitle()).toBe('count');
    await userEvent.keyboard('{End}');
    expect(selectedTitle()).toBe('hymn3');
  });

  it('enters on the first row when nothing is selected', async () => {
    render(<ServiceOrder />);
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('data-value')).toBe('count');
  });

  it('lets Shift Tab leave the list before anything is selected', async () => {
    render(
      <>
        <button type="button">앞</button>
        <ServiceOrder />
        <button type="button">뒤</button>
      </>,
    );
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('data-value')).toBe('count');
    await userEvent.tab({shift: true});
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '앞'}),
    );
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '내리기'}),
    );
  });

  it.each([
    {change: 'remove', first: 'notice'},
    {change: 'disable', first: 'notice'},
    {change: 'enable', first: 'hymn'},
    {change: 'insert', first: 'hymn'},
  ] as const)(
    'keeps Tab entry when descendant rows $change without rendering ListBox',
    async ({change, first}) => {
      const onSelect = vi.fn();
      render(
        <>
          <button type="button">앞</button>
          <ListBox label="예배 순서" selected={undefined} onSelect={onSelect}>
            <ChangingRows change={change} />
          </ListBox>
          <button type="button">뒤</button>
        </>,
      );
      await userEvent.click(screen.getByRole('button', {name: '목록 변경'}));
      await userEvent.click(screen.getByRole('button', {name: '앞'}));
      await userEvent.tab();
      const firstRow = screen
        .getAllByRole('option')
        .find(row => row.dataset['value'] === first);
      expect(document.activeElement).toBe(firstRow);
      expect(
        screen.getAllByRole('option').filter(row => row.tabIndex === 0),
      ).toEqual([firstRow]);
      await userEvent.tab({shift: true});
      expect(document.activeElement).toBe(
        screen.getByRole('button', {name: '앞'}),
      );
      expect(onSelect).not.toHaveBeenCalled();
    },
  );

  it('passes the list keys on when Ctrl, Alt, Shift, or Meta is held', async () => {
    const prevented: string[] = [];
    const listener = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) prevented.push(event.key);
    };
    window.addEventListener('keydown', listener);
    onTestFinished(() => window.removeEventListener('keydown', listener));
    const onSelect = vi.fn();
    render(
      <ServiceOrder workspace="show" initial="count" onSelect={onSelect} />,
    );
    await userEvent.tab();
    for (const modifier of ['Control', 'Alt', 'Shift', 'Meta']) {
      await userEvent.keyboard(
        `{${modifier}>}{ArrowDown}{ArrowUp}{End}{Home}{Enter}{/${modifier}}`,
      );
    }
    expect(onSelect).not.toHaveBeenCalled();
    expect(prevented).toEqual([]);
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedTitle()).toBe('hymn1');
  });
});
