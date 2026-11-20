import {render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {isItemOfKind} from '@core/schema/service';
import {templateOrder} from '@fixtures/core/serviceList';
import {PrepBibleSplitTools} from '@renderer/app/workspaces/PrepBibleSplitTools';

vi.mock('@renderer/features/bible/BibleSplitTools', () => ({
  BibleSplitTools: ({enableManual}: {readonly enableManual: boolean}) => (
    <div data-testid="split-tools" data-enabled={String(enableManual)} />
  ),
}));

it('enables the manual split shortcut for Bible items but not sermons', () => {
  const bible = templateOrder.find(item => isItemOfKind(item, 'bible'));
  if (bible === undefined || !isItemOfKind(bible, 'bible')) {
    throw Error('Missing Bible fixture');
  }
  const sermon = {
    id: bible.id,
    sermon: {title: 'Sermon', passage: bible.bible},
  };
  const props = {selectedIndex: 0, manualRequest: 0, onProblem: vi.fn()};
  const view = render(<PrepBibleSplitTools item={bible} {...props} />);
  expect(screen.getByTestId('split-tools').getAttribute('data-enabled')).toBe(
    'true',
  );
  view.rerender(<PrepBibleSplitTools item={sermon} {...props} />);
  expect(screen.getByTestId('split-tools').getAttribute('data-enabled')).toBe(
    'false',
  );
});
