import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeAll, beforeEach, expect, it, vi} from 'vitest';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import type {ServiceOpenRequest} from '@core/schema/serviceOpen';
import type {ShowService} from '@core/schema/showService';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  ids,
  librarySongs,
  pastDocument,
  serviceEntries,
  templateDocument,
  templateEntries,
  titles,
} from '@fixtures/core/serviceList';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';
import {applyService, useShow} from '@renderer/session/show';

const REFUSED: EditResult = {
  ok: false,
  error: {reason: 'invalid', message: 'Refused in the test'},
};

function setup(answer: (edit: ContentEdit) => EditResult | Error) {
  const open = vi.fn(
    ({serviceId}: ServiceOpenRequest): Promise<ShowService | null> =>
      Promise.resolve({
        ...sampleService,
        id: serviceId,
        name: '새로 만든 예배',
      }),
  );
  window.llp = mockLlpApi({
    templates: {
      list: () => Promise.resolve(templateEntries),
      get: () => Promise.resolve(templateDocument),
    },
    services: {
      list: () => Promise.resolve(serviceEntries),
      get: () => Promise.resolve(pastDocument),
    },
    songs: {list: () => Promise.resolve(librarySongs)},
    content: {
      edit: edit => {
        const result = answer(edit);
        return result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve(result);
      },
    },
    service: {open},
  });
  const onProblem = vi.fn();
  render(<ServiceOrderList workspace="prep" onProblem={onProblem} />);
  return {open, onProblem};
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  applyService(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  applyService(null);
  delete window.llp;
});

it('still reports a failed copy after the new service replaces the empty state', async () => {
  const {open, onProblem} = setup(edit =>
    edit.type === 'service.create'
      ? {ok: true, value: {id: ids.created, revision: 1}}
      : edit.type === 'service.importItems'
        ? REFUSED
        : new Error('Delete failed in the test'),
  );
  expect(screen.getByRole('status').textContent).toContain('예배 없음');

  await userEvent.click(screen.getByRole('button', {name: '새 예배…'}));
  await screen.findByRole('treeitem', {name: titles.first});
  await userEvent.click(screen.getByRole('button', {name: '만들기'}));

  await waitFor(() => expect(onProblem).toHaveBeenCalled());
  expect(open).toHaveBeenCalledWith({serviceId: ids.created});
  expect(useShow.getState().serviceId).toBe(ids.created);
  expect(onProblem.mock.calls[0]?.[0]).toMatchObject({
    title: '새 예배에 항목을 가져올 수 없음',
  });
  expect(screen.queryByRole('dialog', {name: '새 예배'})).toBeNull();
});
