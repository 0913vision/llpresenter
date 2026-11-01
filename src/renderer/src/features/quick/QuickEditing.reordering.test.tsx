import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {createQuickItemId, createAppFlushRequestId} from '@core/schema/ids';
import type {AppFlushRequest} from '@core/schema/appFlush';
import {useLive} from '@renderer/session/live';
import {ControlSession} from '@renderer/app/controlSession';
import {saveQuickEdit} from './quickEdits';
import {
  deferred,
  quickDocument,
  quickId,
  quickItem,
} from '../tools/testing/quickTesting';
import {setup} from './testing/quickEditingFixtures';

describe('quick editing', () => {
  it('persists a pointer reorder without running the item or clearing output', async () => {
    const fixture = setup();
    fixture.mount();
    const first = await screen.findByRole('button', {name: '저장된 곡'});
    const list = screen.getByRole('group', {name: '퀵 실행 항목'});
    const height = fixture.current().value.items.length * 30;
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 200, height),
    );
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => list,
    });
    const live = useLive.getState().state;
    document
      .querySelectorAll<HTMLElement>('[data-quick-id]')
      .forEach((row, index) =>
        vi
          .spyOn(row, 'getBoundingClientRect')
          .mockReturnValue(new DOMRect(0, index * 30, 200, 30)),
      );
    const pointer = {pointerId: 1, button: 0, clientX: 10};
    fireEvent.pointerDown(first, {...pointer, clientY: 15});
    fireEvent.pointerMove(window, {...pointer, clientY: height - 1});
    fireEvent.pointerUp(window, {...pointer, clientY: height - 1});
    fireEvent.click(first, {detail: 1});
    await waitFor(() =>
      expect(fixture.current().value.items.at(-1)?.id).toBe(
        quickItem('song').id,
      ),
    );
    expect(fixture.edit).toHaveBeenCalledOnce();
    expect(fixture.send).not.toHaveBeenCalled();
    expect(useLive.getState().state).toBe(live);
  });
  it('moves an unknown item on the latest list and retains unrelated additions', async () => {
    const fixture = setup();
    const current = fixture.current();
    const source = current.value.items.at(-1);
    if (!source) throw new Error('Missing future row');
    const extra = {
      ...quickItem('black'),
      id: createQuickItemId(quickId(88)),
      name: '다른 변경',
    };
    fixture.push({
      ...current,
      revision: 2,
      value: {...current.value, items: [extra, ...current.value.items]},
    });
    const result = await saveQuickEdit(fixture.api, {
      kind: 'move',
      id: source.id,
      before: quickItem('song').id,
    });
    expect(result.ok).toBe(true);
    expect(fixture.current().value.items.slice(0, 3)).toMatchObject([
      extra,
      {id: source.id, extension: true},
      {id: quickItem('song').id},
    ]);
    expect(fixture.edit.mock.calls[0]?.[0]).toMatchObject({baseRevision: 2});
  });
  it.each(['self', 'same gap', 'missing source', 'missing target'])(
    'does not write a move with %s',
    async kind => {
      const fixture = setup();
      const missing = createQuickItemId(quickId(88));
      const source = kind === 'missing source' ? missing : quickItem('song').id;
      const before =
        kind === 'self'
          ? source
          : kind === 'missing target'
            ? missing
            : quickItem('bible').id;
      expect(
        (await saveQuickEdit(fixture.api, {kind: 'move', id: source, before}))
          .ok,
      ).toBe(true);
      expect(fixture.edit).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    'holds close through a deferred read and stale retry %s',
    async retry => {
      const fixture = setup();
      let request: (value: AppFlushRequest) => void = () => undefined;
      vi.spyOn(fixture.api.app, 'subscribeFlushRequests').mockImplementation(
        listener => {
          request = listener;
          return () => undefined;
        },
      );
      const flushed = vi.spyOn(fixture.api.app, 'flushDone');
      const session = new ControlSession(fixture.api);
      const first = deferred<ReturnType<typeof quickDocument>>();
      const second = deferred<ReturnType<typeof quickDocument>>();
      fixture.get.mockReturnValueOnce(first.promise);
      if (retry) {
        fixture.get.mockReturnValueOnce(second.promise);
        fixture.edit.mockResolvedValueOnce({
          ok: false,
          error: {reason: 'stale', message: 'Invented stale write'},
        });
      }
      const editing = saveQuickEdit(fixture.api, {
        kind: 'rename',
        id: quickItem('song').id,
        name: '새 이름',
      });
      const requestId = createAppFlushRequestId(
        '00000000-0000-4000-8000-000000000008',
      );
      try {
        request({requestId});
        await act(async () => undefined);
        expect(flushed).not.toHaveBeenCalled();
        first.resolve(quickDocument());
        if (retry) {
          await waitFor(() => expect(fixture.get).toHaveBeenCalledTimes(2));
          expect(flushed).not.toHaveBeenCalled();
          second.resolve(quickDocument(2));
        }
        await editing;
        await waitFor(() =>
          expect(flushed).toHaveBeenCalledExactlyOnceWith({
            requestId,
            result: true,
          }),
        );
        expect(fixture.edit.mock.invocationCallOrder.at(-1)).toBeLessThan(
          flushed.mock.invocationCallOrder[0] ?? -Infinity,
        );
        const reads = fixture.get.mock.calls.length;
        await expect(
          saveQuickEdit(fixture.api, {
            kind: 'delete',
            id: quickItem('song').id,
          }),
        ).rejects.toThrow();
        expect(fixture.get).toHaveBeenCalledTimes(reads);
      } finally {
        first.resolve(quickDocument());
        second.resolve(quickDocument(2));
        await editing.catch(() => undefined);
        await session.dispose();
      }
    },
  );
});
