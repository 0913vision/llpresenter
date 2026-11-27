import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';

afterEach(() => {
  cleanup();
  delete window.llp;
});

function setup(doubleClickPrep: boolean) {
  const preferences = settingsDocument('preferences', {
    show: {doubleClickPrep},
  });
  window.llp = mockLlpApi({
    settings: {
      get: query =>
        query.name === 'preferences'
          ? Promise.resolve(preferences)
          : Promise.reject(new Error(`No ${query.name} here`)),
      subscribe: () => () => undefined,
    },
  });
  seedSampleService();
  const onOpenPrep = vi.fn();
  render(<ServiceOrderList workspace="show" onOpenPrep={onOpenPrep} />);
  return onOpenPrep;
}

it('opens a double clicked 진행 item in 준비 when 환경설정 says so (USER Nov 28)', async () => {
  const onOpenPrep = setup(true);
  const row = screen.getAllByRole('option')[1];
  if (row === undefined) throw new Error('Missing row');
  await waitFor(() => {
    fireEvent.doubleClick(row);
    expect(onOpenPrep).toHaveBeenCalledWith(row.getAttribute('data-value'));
  });
});

it('leaves a double click in 진행 alone while the setting is off, as it starts', async () => {
  const onOpenPrep = setup(false);
  const row = screen.getAllByRole('option')[1];
  if (row === undefined) throw new Error('Missing row');
  await new Promise(resolve => setTimeout(resolve, 50));
  fireEvent.doubleClick(row);
  expect(onOpenPrep).not.toHaveBeenCalled();
});
