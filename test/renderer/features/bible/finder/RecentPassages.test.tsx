import {fireEvent, render, screen, within} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {parsedTranslation} from '@fixtures/core/bible/testFiles';
import {RecentPassages} from '@renderer/features/bible/finder/RecentPassages';

it('labels recent passages from other translations and follows the selected translation', () => {
  const first = parsedTranslation().id;
  const second = parsedTranslation({...parsedTranslation(), id: 'other'}).id;
  const translations = [
    {
      id: first,
      name: 'First',
      lang: 'ko',
      file: 'first.llbible',
      default: true,
    },
    {
      id: second,
      name: 'Second',
      lang: 'ko',
      file: 'second.llbible',
      default: false,
    },
  ];
  const recents = [
    {ref: 'John 3:16-18', translation: first},
    {ref: 'John 3:16-18', translation: second},
  ];
  const onPick = vi.fn();
  const {rerender} = render(
    <RecentPassages
      recents={recents}
      translations={translations}
      translation={first}
      onPick={onPick}
    />,
  );
  const rows = within(screen.getByLabelText('최근 성경 구절')).getAllByRole(
    'button',
  );
  expect(rows[0]?.textContent).not.toContain('First');
  expect(rows[1]?.textContent).toContain('Second');
  const secondRow = rows[1];
  if (!secondRow) throw new Error('Missing second recent');
  fireEvent.click(secondRow);
  expect(onPick).toHaveBeenCalledWith(recents[1]);
  rerender(
    <RecentPassages
      recents={recents}
      translations={translations}
      translation={second}
      onPick={onPick}
    />,
  );
  expect(rows[0]?.textContent).toContain('First');
  expect(rows[1]?.textContent).not.toContain('Second');
});
