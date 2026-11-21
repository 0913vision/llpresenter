import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {ServiceGridLoading} from '@renderer/app/ServiceGridLoading';
import {applyService} from '@renderer/session/show';
import {retainShownGrid} from '@renderer/session/shownItem';
import {sampleService} from '@fixtures/renderer/session/sampleService';

afterEach(() => {
  cleanup();
  applyService(null);
});

it('waits for each new service but does not block the screen for later edits', () => {
  const service = {
    ...sampleService,
    rows: sampleService.rows.filter(
      row => row.id === 'song-morning' || row.id === 'song-river',
    ),
  };
  applyService(service);
  render(<ServiceGridLoading />);
  const progress = () =>
    screen.queryByRole('progressbar', {name: '예배 준비 진행률'});
  expect(progress()?.getAttribute('value')).toBe('0');
  let first = () => {};
  let second = () => {};
  act(() => {
    first = retainShownGrid(service.id, 'song-morning');
  });
  expect(progress()?.getAttribute('value')).toBe('1');
  act(() => {
    second = retainShownGrid(service.id, 'song-river');
  });
  expect(progress()).toBeNull();
  act(first);
  expect(progress()).toBeNull();
  act(() => applyService({...service, id: 'another-service'}));
  expect(progress()?.getAttribute('value')).toBe('0');
  act(second);
});
