import {afterEach, expect, it, vi} from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {BibleLoadNotice} from '@renderer/features/bible/BibleLoadNotice';
import type {ItemRow} from '@core/presentation/model';

afterEach(() => {
  cleanup();
  delete window.llp;
});
it('shows a loading state and retries an unavailable saved passage on request', async () => {
  const request = lookupRequest('John 3:16');
  const api = mockLlpApi();
  const lookup = vi.spyOn(api.bible, 'lookup');
  const refresh = vi.spyOn(api.service, 'get');
  window.llp = api;
  const row: ItemRow = {
    kind: 'bible',
    id: 'saved',
    title: 'Sermon',
    bible: {translation: request.translation, ref: request.input},
    problem: 'loading-bible',
  };
  const view = render(<BibleLoadNotice row={row} />);
  expect(screen.getByRole('status').textContent).toContain(
    '\ubcf8\ubb38\uc744 \ubc1b\ub294 \uc911\uc785\ub2c8\ub2e4',
  );
  expect(screen.queryByRole('button')).toBeNull();
  view.rerender(<BibleLoadNotice row={{...row, problem: 'missing-bible'}} />);
  fireEvent.click(
    screen.getByRole('button', {name: '\ub2e4\uc2dc \uc2dc\ub3c4'}),
  );
  await waitFor(() =>
    expect(lookup).toHaveBeenCalledWith({
      translation: request.translation,
      input: request.input,
    }),
  );
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
});
