import {beforeEach, expect, it, vi} from 'vitest';
import {createServiceItemId} from '@core/schema/common/ids';
import type {ServiceItem} from '@core/schema/services/service';
import type {OpenServiceResult} from '@renderer/session/service/openService';
import {useHeaderRename} from '@renderer/session/service/headerRename';
import {insertNewItem} from '@renderer/session/service/insertIntoOrder';
import {usePrepTarget} from '@renderer/session/prepTarget';

const edits = vi.hoisted(() => ({
  insertItem: vi.fn<() => Promise<OpenServiceResult>>(),
  insertSong: vi.fn(),
}));
vi.mock('@renderer/session/service/serviceOrderEdits', () => edits);

const HEADER: ServiceItem = {
  id: createServiceItemId('00000000-0000-4000-8000-000000000201'),
  kind: 'header',
  name: '새 구역',
};
const OPENED: OpenServiceResult = {ok: true, value: true};
const NOT_FOUND: OpenServiceResult = {
  ok: false,
  error: {reason: 'not-found', message: 'The drop target is gone'},
};
const UNSAVED: OpenServiceResult = {
  ok: false,
  error: {
    reason: 'write-failed',
    message: 'disk full',
    applied: {id: 'service', revision: 2},
    unchangedFiles: ['service.llservice'],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  useHeaderRename.getState().clear();
});

it('opens the name of a new 구역 for typing as soon as it is put in', async () => {
  edits.insertItem.mockResolvedValue(OPENED);
  insertNewItem(HEADER, null, {report: vi.fn()});
  expect(useHeaderRename.getState().requested).toBe(HEADER.id);
  await vi.waitFor(() => expect(edits.insertItem).toHaveBeenCalled());
  expect(useHeaderRename.getState().requested).toBe(HEADER.id);
});

it('takes the rename back when the 구역 was not put in', async () => {
  edits.insertItem.mockResolvedValue(NOT_FOUND);
  const report = vi.fn();
  insertNewItem(HEADER, null, {report});
  await vi.waitFor(() =>
    expect(useHeaderRename.getState().requested).toBeNull(),
  );
});

it('keeps the rename of a 구역 that is in the order but not yet saved to its file', async () => {
  edits.insertItem.mockResolvedValue(UNSAVED);
  insertNewItem(HEADER, null, {report: vi.fn()});
  await vi.waitFor(() => expect(edits.insertItem).toHaveBeenCalled());
  await Promise.resolve();
  expect(useHeaderRename.getState().requested).toBe(HEADER.id);
});

it('opens a new item in 준비 when asked, once it is in the order', async () => {
  edits.insertItem.mockResolvedValue(OPENED);
  const before = usePrepTarget.getState().request;
  insertNewItem(HEADER, null, {report: vi.fn(), edit: true});
  await vi.waitFor(() =>
    expect(usePrepTarget.getState().request).toBe(before + 1),
  );
  expect(usePrepTarget.getState().target).toEqual({
    kind: 'item',
    itemId: HEADER.id,
  });
});
