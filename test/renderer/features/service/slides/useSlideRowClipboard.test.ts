import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {SlidesDraft, newSlidesItem} from '@core/services/slidesEdits';
import {useSlideRowClipboard} from '@renderer/features/service/slides/useSlideRowClipboard';
import type {RowClipboardData} from '@renderer/features/service/slides/slideRowsClipboard';

const io = vi.hoisted(() => ({
  read: vi.fn<() => Promise<RowClipboardData>>(),
  write: vi.fn<(data: RowClipboardData) => Promise<void>>(),
}));
vi.mock(
  '@renderer/features/service/slides/slideRowsClipboard',
  async importOriginal => ({
    ...(await importOriginal<
      typeof import('@renderer/features/service/slides/slideRowsClipboard')
    >()),
    readRowClipboard: io.read,
    writeRowClipboard: io.write,
  }),
);
beforeEach(() => {
  io.read.mockReset();
  io.write.mockReset().mockResolvedValue();
});
afterEach(() => vi.restoreAllMocks());
function setup() {
  const draft = new SlidesDraft(
    newSlidesItem(
      'blank',
      createServiceItemId('10000000-0000-4000-8000-000000000001'),
    ),
  );
  const update = vi.fn(),
    report = vi.fn();
  const hook = renderHook(
    ({blocked}) => useSlideRowClipboard({draft, blocked, update, report}),
    {initialProps: {blocked: false}},
  );
  return {draft, update, report, ...hook};
}
describe('asynchronous row clipboard commands', () => {
  it('writes the clipboard before cutting, then pastes with one undo step per edit', async () => {
    const {draft, result, unmount} = setup();
    await result.current.copy(true);
    expect(draft.snapshot.item.slides.slides).toHaveLength(0);
    const data = io.write.mock.calls[0]?.[0];
    if (!data) throw new Error('Missing clipboard write');
    io.read.mockResolvedValue(data);
    await result.current.paste();
    expect(draft.snapshot.item.slides.slides).toHaveLength(1);
    draft.undo();
    expect(draft.snapshot.item.slides.slides).toHaveLength(0);
    draft.undo();
    expect(draft.snapshot.item.slides.slides).toHaveLength(1);
    unmount();
  });
  it('keeps the deck and undo history when the clipboard write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const {draft, result, report, unmount} = setup();
    io.write.mockRejectedValue(new Error('Clipboard unavailable'));
    await result.current.copy(true);
    expect(draft.snapshot.item.slides.slides).toHaveLength(1);
    expect(draft.canUndo).toBe(false);
    expect(report).toHaveBeenCalledWith('슬라이드 복사 실패');
    unmount();
  });
  it.each(['blocked', 'selection', 'unmount'] as const)(
    'ignores a late paste after %s',
    async change => {
      const {draft, result, rerender, unmount, update} = setup();
      let resolve: (data: RowClipboardData) => void = () => undefined;
      const promise = new Promise<RowClipboardData>(done => {
        resolve = done;
      });
      io.read.mockReturnValue(promise);
      const pending = result.current.paste();
      if (change === 'blocked') rerender({blocked: true});
      else if (change === 'selection') {
        draft.selectRows({type: 'gap', index: 0});
      } else unmount();
      await act(async () => {
        resolve({text: 'Late', rows: ''});
        await pending;
      });
      expect(draft.snapshot.item.slides.slides).toHaveLength(1);
      expect(update).not.toHaveBeenCalled();
      if (change !== 'unmount') unmount();
    },
  );
});
