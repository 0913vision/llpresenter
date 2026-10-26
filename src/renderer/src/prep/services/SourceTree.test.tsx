import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {Dialog} from '@renderer/ui/Dialog';
import {checkAll, treeRows, type TreeSelection} from './serviceTree';
import {SourceTree} from './SourceTree';
import {ids, songTitles, templateOrder, titles} from './testing';

const rows = treeRows(templateOrder, songTitles);

function Tree({
  initial = checkAll(rows, true),
}: {
  readonly initial?: TreeSelection;
}): JSX.Element {
  const [selection, setSelection] = useState(initial);
  return (
    <SourceTree rows={rows} selection={selection} onChange={setSelection} />
  );
}

function item(name: string): HTMLElement {
  return screen.getByRole('treeitem', {name});
}

function state(name: string): string | null {
  return item(name).getAttribute('aria-checked');
}

function position(name: string): ReadonlyArray<string | null> {
  const row = item(name);
  return ['aria-level', 'aria-posinset', 'aria-setsize'].map(key =>
    row.getAttribute(key),
  );
}

describe('SourceTree', () => {
  it('shows a tree of headers and items with levels, details, and states', () => {
    render(<Tree />);
    const tree = screen.getByRole('tree', {name: '예배 순서 항목'});
    expect(tree.getAttribute('aria-multiselectable')).toBe('true');
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(7);
    expect(within(tree).queryAllByRole('checkbox')).toEqual([]);
    expect(screen.getByText('항목 4개')).toBeDefined();
    expect(
      screen
        .getByRole('checkbox', {name: '예배 순서'})
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(position('찬양')).toEqual(['1', '1', '3']);
    expect(position(titles.second)).toEqual(['2', '2', '2']);
    expect(position('헌금 찬양')).toEqual(['2', '2', '2']);
    expect(position('광고')).toEqual(['1', '3', '3']);
    expect(state('찬양')).toBe('true');
    const slot = item('헌금 찬양');
    const detail = document.getElementById(
      slot.getAttribute('aria-describedby') ?? '',
    );
    expect(detail?.textContent).toBe('빈 자리');
    expect(screen.getByText('주일용')).toBeDefined();
  });

  it('checks a header with its items and shows the mixed states', async () => {
    render(<Tree initial={new Set([ids.closing])} />);
    expect(
      screen
        .getByRole('checkbox', {name: '예배 순서'})
        .getAttribute('aria-checked'),
    ).toBe('mixed');
    await userEvent.click(item('찬양'));
    expect(state(titles.first)).toBe('true');
    expect(state(titles.second)).toBe('true');
    await userEvent.click(item(titles.second));
    expect(state('찬양')).toBe('mixed');
    expect(document.activeElement).toBe(item(titles.second));
    await userEvent.click(screen.getByRole('checkbox', {name: '예배 순서'}));
    expect(state('찬양')).toBe('true');
    expect(state('말씀')).toBe('true');
    expect(state('광고')).toBe('true');
  });

  it('moves with the arrows, Home, End, and Left, and toggles with Space', async () => {
    render(<Tree />);
    const focusable = screen
      .getAllByRole('treeitem')
      .filter(row => row.tabIndex === 0);
    expect(focusable).toEqual([item('찬양')]);
    item('찬양').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item(titles.first));
    await userEvent.keyboard(' ');
    expect(state(titles.first)).toBe('false');
    expect(state('찬양')).toBe('mixed');
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(item('광고'));
    await userEvent.keyboard('{Home}{ArrowDown}{ArrowDown}{ArrowLeft}');
    expect(document.activeElement).toBe(item('찬양'));
    expect(item('찬양').tabIndex).toBe(0);
    expect(item(titles.second).tabIndex).toBe(-1);
  });

  it('keeps Enter in the tree inside a dialog', async () => {
    const onSelect = vi.fn();
    render(
      <Dialog
        title="새 예배"
        size="l"
        onCancel={() => undefined}
        primary={{label: '만들기', onSelect}}
      >
        <Tree />
      </Dialog>,
    );
    const box = item(titles.first).querySelector('[role="checkbox"]');
    if (box === null) throw new Error('No box in the row');
    await userEvent.click(box);
    expect(state(titles.first)).toBe('false');
    expect(document.activeElement).toBe(item(titles.first));
    await userEvent.keyboard('{Enter}');
    item('찬양').focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
    screen.getByRole('checkbox', {name: '예배 순서'}).focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('says why it is empty, without a check-all box', () => {
    render(
      <SourceTree
        rows={[]}
        selection={new Set()}
        onChange={() => undefined}
        empty="예배 순서를 읽을 수 없습니다"
      />,
    );
    expect(screen.getByText('항목 0개')).toBeDefined();
    expect(screen.getByText('예배 순서를 읽을 수 없습니다')).toBeDefined();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('tree')).toBeNull();
  });
});
