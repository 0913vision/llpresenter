import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it} from 'vitest';
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

function state(name: string): string | null {
  return screen.getByRole('checkbox', {name}).getAttribute('aria-checked');
}

describe('SourceTree', () => {
  it('shows the count, the check-all box, and every row with its detail', () => {
    render(<Tree />);
    expect(screen.getByText('항목 4개')).toBeDefined();
    expect(state('예배 순서')).toBe('true');
    expect(screen.getByText('주일용')).toBeDefined();
    expect(screen.getByText('빈 자리')).toBeDefined();
    expect(screen.getAllByRole('checkbox')).toHaveLength(8);
  });

  it('checks a header with its items and shows the mixed states', async () => {
    render(<Tree initial={new Set([ids.closing])} />);
    expect(state('예배 순서')).toBe('mixed');
    await userEvent.click(screen.getByRole('checkbox', {name: '찬양'}));
    expect(state(titles.first)).toBe('true');
    expect(state(titles.second)).toBe('true');
    await userEvent.click(screen.getByRole('checkbox', {name: titles.second}));
    expect(state('찬양')).toBe('mixed');
    await userEvent.click(screen.getByRole('checkbox', {name: '예배 순서'}));
    expect(state('찬양')).toBe('true');
    expect(state('말씀')).toBe('true');
    expect(state('광고')).toBe('true');
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
  });
});
