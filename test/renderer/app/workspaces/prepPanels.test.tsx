import {act, renderHook, waitFor} from '@testing-library/react';
import {isValidElement} from 'react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {itemFixture} from '@fixtures/renderer/features/service/items/itemFixture';
import {usePrepPanels} from '@renderer/app/workspaces/prepPanels';
import {
  SERVICE_ORDER,
  serviceOrderParts,
} from '@renderer/app/workspaces/serviceOrderPanel';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';

vi.mock('@renderer/app/workspaces/serviceOrderPanel', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@renderer/app/workspaces/serviceOrderPanel')
  >()),
  serviceOrderParts: vi.fn(() => ({})),
}));

function setup() {
  const fixture = itemFixture();
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  onTestFinished(() => {
    items.dispose();
    return editor.dispose();
  });
  const onServiceItemOpen = vi.fn();
  const {result} = renderHook(() =>
    usePrepPanels({
      prep: {api: fixture.api, editor, items, onServiceItemOpen},
      sizeClass: 'normal',
      onProblem: undefined,
      onOpenPrep: undefined,
      onShowInLibrary: undefined,
    }),
  );
  return {fixture, editor, onServiceItemOpen, result};
}

describe('usePrepPanels', () => {
  it.each(['library', 'item'])(
    'guards returning to the table from the inline %s slide grid',
    source => {
      const {fixture, editor, result} = setup();
      act(() =>
        editor.open(
          fixture.first,
          source === 'item' ? {content: fixture.api.content} : {},
        ),
      );
      let proceed: (() => void) | undefined;
      const leave = vi
        .spyOn(editor, 'requestLeave')
        .mockImplementation(action => {
          proceed = action;
        });
      const open = vi.spyOn(editor, 'open');
      const panel = result.current.partsOf('슬라이드').embedded;
      if (!isValidElement<{onBack?: () => void}>(panel)) {
        throw new Error('Missing slide panel');
      }
      act(() => panel.props.onBack?.());
      expect(leave).toHaveBeenCalledOnce();
      expect(open).not.toHaveBeenCalled();
      act(() => proceed?.());
      expect(open).toHaveBeenCalledExactlyOnceWith(null);
    },
  );

  it('opens a service item, even the one already open, by leaving the editor first', () => {
    const {editor, onServiceItemOpen, result} = setup();
    const requestLeave = vi
      .spyOn(editor, 'requestLeave')
      .mockImplementation(leave => leave());
    const open = vi.spyOn(editor, 'open');
    result.current.partsOf(SERVICE_ORDER);
    const onOpenItem =
      vi.mocked(serviceOrderParts).mock.lastCall?.[0].onOpenItem;

    act(() => onOpenItem?.());
    act(() => onOpenItem?.());

    expect(requestLeave).toHaveBeenCalledTimes(2);
    expect(onServiceItemOpen).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith(null);
    expect(onServiceItemOpen.mock.invocationCallOrder[0]).toBeLessThan(
      open.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('lays out the library, the 예배 순서 table, and the selected item', () => {
    const {result} = setup();

    expect(result.current.columns).toEqual([
      ['라이브러리'],
      [SERVICE_ORDER],
      ['미리보기', '슬라이드'],
    ]);
  });

  it('swaps the table for the editor while the editor holds a draft', async () => {
    const {fixture, editor, result} = setup();
    const columns = result.current.columns;

    act(() => editor.open(fixture.first));

    await waitFor(() => expect(result.current.columns).not.toEqual(columns));
    act(() => editor.open(null));
    await waitFor(() => expect(result.current.columns).toEqual(columns));
  });

  it('draws the 예배 순서 as the table, not the plain list', () => {
    const {fixture, result} = setup();
    result.current.partsOf(SERVICE_ORDER);

    expect(vi.mocked(serviceOrderParts).mock.lastCall?.[0].table?.api).toBe(
      fixture.api,
    );
  });
});
