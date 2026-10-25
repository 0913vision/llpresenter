import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ListBox, ListRow} from './ListRow';

const iconRenders = vi.hoisted((): string[] => []);

vi.mock('./Icon', () => ({
  Icon: ({name}: {readonly name: string}): null => {
    iconRenders.push(name);
    return null;
  },
}));

const rows = [
  {value: 'count', icon: 'film', title: '예배 전 카운트다운'},
  {value: 'notice', icon: 'notice', title: '주일 광고'},
  {value: 'hymn', icon: 'song', title: '만복의 근원 하나님'},
  {value: 'word', icon: 'book', title: '요한복음 3장 16절'},
] as const;

function ServiceOrder(): JSX.Element {
  const [selected, setSelected] = useState<string | undefined>('count');
  const [live, setLive] = useState('notice');
  return (
    <>
      <button type="button" onClick={() => setLive('word')}>
        다음 항목
      </button>
      <ListBox label="예배 순서" selected={selected} onSelect={setSelected}>
        {rows.map(row => (
          <ListRow key={row.value} {...row} live={row.value === live} />
        ))}
      </ListBox>
    </>
  );
}

beforeEach(() => {
  iconRenders.length = 0;
});

describe('ListBox rendering', () => {
  it('redraws only the rows whose selection changed', async () => {
    render(<ServiceOrder />);
    iconRenders.length = 0;
    await userEvent.click(
      screen.getByRole('option', {name: '만복의 근원 하나님'}),
    );
    expect(iconRenders.toSorted()).toEqual(['film', 'song']);
  });

  it('redraws only the rows whose live mark changed', async () => {
    render(<ServiceOrder />);
    iconRenders.length = 0;
    await userEvent.click(screen.getByRole('button', {name: '다음 항목'}));
    expect(iconRenders.toSorted()).toEqual(['book', 'notice']);
  });
});
