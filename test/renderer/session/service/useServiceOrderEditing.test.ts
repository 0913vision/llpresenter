import {renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {EditResult} from '@core/schema/services/contentEdit';
import type {Notice} from '@renderer/ui/popups/notices';
import type {OpenServiceResult} from '@renderer/session/service/openService';
import {useServiceOrderEditing} from '@renderer/session/service/useServiceOrderEditing';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

afterEach(() => {
  delete window.llp;
});

function setup(retry: () => Promise<EditResult>) {
  const edit = vi.fn(retry);
  const write = vi.fn();
  window.llp = mockLlpApi({content: {edit}, log: {write}});
  const notices: Notice[] = [];
  const {result} = renderHook(() =>
    useServiceOrderEditing(notice => notices.push(notice)),
  );
  return {editing: result.current, edit, write, notices};
}

const WRITTEN: EditResult = {ok: true, value: {id: 'service', revision: 2}};

/** An order edit the open service applied; `written` when its file was saved too. */
function applied(written: boolean): () => Promise<OpenServiceResult> {
  return () => Promise.resolve({ok: true, value: written});
}

it('saves an edit that was applied but not written once more before it says it is saved', async () => {
  const {editing, edit, notices} = setup(() => Promise.resolve(WRITTEN));
  await expect(editing.save(applied(false))).resolves.toBe(true);
  expect(edit).toHaveBeenCalledExactlyOnceWith({type: 'saves.retry'});
  expect(notices).toEqual([]);
});

it('does not save again what was already written, nor for an edit that only has to apply', async () => {
  const {editing, edit} = setup(() => Promise.resolve(WRITTEN));
  await expect(editing.save(applied(true))).resolves.toBe(true);
  await expect(editing.apply(applied(false))).resolves.toBe(true);
  expect(edit).not.toHaveBeenCalled();
});

it('says 예배 저장 실패 with the standard reason when the second save fails too', async () => {
  const {editing, notices} = setup(() =>
    Promise.resolve({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'disk full',
        applied: {id: 'service', revision: 2},
        unchangedFiles: ['services/service.llservice'],
      },
    }),
  );
  await expect(editing.save(applied(false))).resolves.toBe(false);
  expect(notices.map(notice => [notice.title, notice.meta])).toEqual([
    [
      '예배 저장 실패',
      [
        '변경 내용을 파일에 저장할 수 없습니다.',
        '디스크 공간과 폴더 권한을 확인하십시오.',
      ],
    ],
  ]);
});

it('says why an edit was refused, and logs a request that failed with its cause', async () => {
  const {editing, write, notices} = setup(() => Promise.resolve(WRITTEN));
  await expect(
    editing.apply(() =>
      Promise.resolve({
        ok: false,
        error: {reason: 'stale', message: 'newer file'},
      }),
    ),
  ).resolves.toBe(false);
  await expect(
    editing.apply(() => Promise.reject(new Error('Invented failure'))),
  ).resolves.toBe(false);
  expect(notices.map(notice => notice.title)).toEqual([
    '예배 변경 실패',
    '예배 변경 실패',
  ]);
  expect(notices[0]?.meta).toEqual([
    '다른 곳에서 먼저 변경되었습니다.',
    '다시 시도하십시오.',
  ]);
  expect(JSON.stringify(write.mock.calls)).toContain('Invented failure');
});
