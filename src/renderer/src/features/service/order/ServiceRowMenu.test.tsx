import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import type {ServiceEntry} from '@core/schema/contentDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {ids, pastDocument} from '@core/testing/serviceList';
import {applyService, useShow} from '@renderer/session/show';
import {sampleService} from '../../../session/testing/sampleService';
import {ServiceOrderHeader} from './ServiceOrderHeader';

const pastName = pastDocument.service.name;
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  applyService(null);
  applyService({...sampleService, id: ids.created, name: '열린 예배'});
});
afterEach(() => {
  cleanup();
  delete window.llp;
  applyService(null);
});

function setup() {
  let entries: readonly ServiceEntry[] = [
    {
      id: ids.created,
      name: '열린 예배',
      date: '2026-11-01T11:00',
      access: 'editable',
    },
    {
      id: ids.past,
      name: pastName,
      date: pastDocument.service.date,
      access: 'editable',
    },
  ];
  let push: (list: readonly ServiceEntry[]) => void = () => undefined;
  const document = {
    ...pastDocument,
    service: {...pastDocument.service, future: {keep: true}},
    revision: 7,
  };
  const edit = vi.fn(async (change: ContentEdit): Promise<EditResult> => {
    if (change.type === 'service.update') {
      entries = entries.map(entry =>
        entry.id === change.service.id
          ? {...entry, name: change.service.name}
          : entry,
      );
      push(entries);
      return {ok: true, value: {id: change.service.id, revision: 8}};
    }
    if (change.type === 'service.saveAsTemplate') {
      return {ok: true, value: {id: ids.template, revision: 1}};
    }
    if (change.type === 'service.delete') {
      return {ok: true, value: {id: change.serviceId, revision: null}};
    }
    throw new Error('Unexpected service edit');
  });
  const api = fakeLlpApi({
    services: {
      list: async () => entries,
      get: async () => document,
      subscribeList: listener => {
        push = listener;
        return () => undefined;
      },
    },
    content: {edit},
  });
  const open = vi.spyOn(api.service, 'open');
  const onProblem = vi.fn();
  window.llp = api;
  render(<ServiceOrderHeader onProblem={onProblem} />);
  return {api, edit, open, onProblem, document};
}

async function openPicker() {
  fireEvent.click(
    screen.getByRole('button', {
      name: useShow.getState().serviceId === null ? '예배 순서' : '열린 예배',
    }),
  );
  return screen.findByRole('menuitemradio', {name: new RegExp(`^${pastName}`)});
}
async function context() {
  fireEvent.contextMenu(await openPicker(), {clientX: 80, clientY: 120});
  return screen.getByRole('menu', {name: '예배 메뉴'});
}

it('lists the service menu rows and groups in spec order without opening the service', async () => {
  const {edit, open} = setup();
  const menu = await context();
  expect(
    [...menu.querySelectorAll('[role=menuitem], [role=separator]')].map(row =>
      row.getAttribute('role') === 'separator' ? '|' : row.textContent,
    ),
  ).toEqual([
    '이름 바꾸기',
    '템플릿으로 저장…',
    '|',
    '내보내기',
    '인쇄',
    '|',
    '복제',
    '삭제',
  ]);
  for (const name of ['내보내기', '인쇄', '복제']) {
    expect(
      within(menu).getByRole('menuitem', {name}).getAttribute('aria-disabled'),
    ).toBe('true');
  }
  expect(open).not.toHaveBeenCalled();
  expect(edit).not.toHaveBeenCalled();
});

it('renames inline through the existing service revision/save path and preserves unknown fields', async () => {
  const {edit, document: source} = setup();
  fireEvent.click(
    within(await context()).getByRole('menuitem', {name: '이름 바꾸기'}),
  );
  const field = await screen.findByRole('textbox', {name: `${pastName} 이름`});
  expect(document.activeElement).toBe(field);
  fireEvent.change(field, {target: {value: '  새 예배 이름  '}});
  fireEvent.keyDown(field, {key: 'Enter', code: 'Enter'});
  await waitFor(() =>
    expect(edit).toHaveBeenCalledExactlyOnceWith({
      type: 'service.update',
      service: {...source.service, name: '새 예배 이름'},
      baseRevision: 7,
    }),
  );
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(
    screen.getByRole('menuitemradio', {name: /^새 예배 이름/}),
  ).toBeTruthy();
  expect(useShow.getState().serviceId).toBe(ids.created);
});

it('cancels an inline rename with Escape without closing the picker', async () => {
  const {edit} = setup();
  fireEvent.click(
    within(await context()).getByRole('menuitem', {name: '이름 바꾸기'}),
  );
  const field = await screen.findByRole('textbox', {name: `${pastName} 이름`});
  fireEvent.change(field, {target: {value: '취소할 이름'}});
  fireEvent.keyDown(field, {key: 'Escape', code: 'Escape'});
  expect(screen.getByRole('menu', {name: '예배 순서 선택'})).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole('combobox', {name: '검색'}),
  );
  expect(edit).not.toHaveBeenCalled();
});

it.each([true, false])(
  'saves the clicked service as a template with an open service=%s',
  async hasOpenService => {
    const {edit, open} = setup();
    if (!hasOpenService) act(() => applyService(null));
    fireEvent.click(
      within(await context()).getByRole('menuitem', {name: '템플릿으로 저장…'}),
    );
    await waitFor(() =>
      expect(edit).toHaveBeenCalledExactlyOnceWith({
        type: 'service.saveAsTemplate',
        serviceId: ids.past,
        name: pastName,
      }),
    );
    expect(screen.queryByRole('menu')).toBeNull();
    expect(open).not.toHaveBeenCalled();
  },
);

it('reports a refused inline rename and keeps the original service', async () => {
  const {edit, onProblem} = setup();
  edit.mockResolvedValueOnce({
    ok: false,
    error: {reason: 'stale', message: 'Invented conflict'},
  });
  fireEvent.click(
    within(await context()).getByRole('menuitem', {name: '이름 바꾸기'}),
  );
  const field = await screen.findByRole('textbox', {name: `${pastName} 이름`});
  fireEvent.change(field, {target: {value: '저장할 수 없는 이름'}});
  fireEvent.keyDown(field, {key: 'Enter', code: 'Enter'});
  await waitFor(() =>
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({title: '이름을 바꿀 수 없음'}),
    ),
  );
  expect(
    screen.getByRole('menuitemradio', {name: new RegExp(`^${pastName}`)}),
  ).toBeTruthy();
});

it('uses the existing conflict prompt and saves a new template for the clicked service', async () => {
  const {api, edit} = setup();
  vi.spyOn(api.templates, 'list').mockResolvedValue([
    {id: ids.template, name: pastName, access: 'editable'},
  ]);
  fireEvent.click(
    within(await context()).getByRole('menuitem', {name: '템플릿으로 저장…'}),
  );
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(
    within(dialog).getByRole('button', {name: '새 템플릿으로 저장'}),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenCalledExactlyOnceWith({
      type: 'service.saveAsTemplate',
      serviceId: ids.past,
      name: `${pastName} 2`,
    }),
  );
});

it('disables deleting the open service', async () => {
  const {edit} = setup();
  await openPicker();
  fireEvent.contextMenu(
    screen.getByRole('menuitemradio', {name: /^열린 예배/}),
  );
  const remove = within(
    screen.getByRole('menu', {name: '예배 메뉴'}),
  ).getByRole('menuitem', {name: '삭제'});
  expect(remove.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(remove);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(edit).not.toHaveBeenCalled();
});

it('confirms and deletes the clicked closed service', async () => {
  const {edit, open} = setup();
  fireEvent.click(
    within(await context()).getByRole('menuitem', {name: '삭제'}),
  );
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: '삭제',
    }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenCalledExactlyOnceWith({
      type: 'service.delete',
      serviceId: ids.past,
    }),
  );
  expect(open).not.toHaveBeenCalled();
});

it.each([{key: 'ContextMenu'}, {key: 'F10', shiftKey: true}])(
  'opens the pointed row menu with $key',
  async keys => {
    setup();
    await openPicker();
    fireEvent.keyDown(screen.getByRole('combobox', {name: '검색'}), {
      key: 'ArrowDown',
    });
    fireEvent.keyDown(screen.getByRole('combobox', {name: '검색'}), keys);
    expect(screen.getByRole('menu', {name: '예배 메뉴'})).toBeTruthy();
  },
);
