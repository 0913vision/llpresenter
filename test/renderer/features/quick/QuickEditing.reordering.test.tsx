import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {createQuickItemId} from '@core/schema/ids';
import {useLive} from '@renderer/session/live';
import {saveQuickEdit} from '@renderer/features/quick/quickEdits';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {
  deferred,
  quickDocument,
  quickId,
  quickItem,
} from '@fixtures/renderer/features/tools/quickTesting';
import {setup} from '@fixtures/renderer/features/quick/quickEditingFixtures';

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
  it('holds the close gate through a stale write and its fresh read', async () => {
    const fixture = setup();
    const first = deferred<ReturnType<typeof quickDocument>>();
    const second = deferred<ReturnType<typeof quickDocument>>();
    fixture.get
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    fixture.edit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Invented stale write'},
    });
    const saving = saveQuickEdit(fixture.api, {
      kind: 'rename',
      id: quickItem('song').id,
      name: '새 이름',
    });
    let closed = false;
    const closing = pendingWritesOf(fixture.api)
      .flush()
      .then(ok => {
        closed = true;
        return ok;
      });

    await act(async () => undefined);
    expect(closed).toBe(false);
    first.resolve(quickDocument());
    await waitFor(() => expect(fixture.get).toHaveBeenCalledTimes(2));
    expect(closed).toBe(false);
    second.resolve(quickDocument(2));
    await saving;

    expect(await closing).toBe(true);
    expect(fixture.edit).toHaveBeenCalledTimes(2);
  });
});
