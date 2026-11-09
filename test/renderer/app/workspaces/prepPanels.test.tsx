import {act, renderHook, waitFor} from '@testing-library/react';
import {isValidElement} from 'react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {useShow} from '@renderer/session/show';
import {itemFixture} from '@fixtures/renderer/features/service/items/itemFixture';
import {usePrepPanels} from '@renderer/app/workspaces/prepPanels';
import {
  SERVICE_ORDER,
  serviceOrderParts,
} from '@renderer/app/workspaces/serviceOrderPanel';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {SlideInspector} from '@renderer/features/service/slideInspector/SlideInspector';
import {SlidesInspector} from '@renderer/features/service/slideInspector/SlidesInspector';
import {OtherSlideInspector} from '@renderer/features/service/slideInspector/OtherSlideInspector';
import {useSlidesEditor} from '@renderer/features/service/slides/useSlidesEditor';
import {newSlidesItem} from '@core/services/slidesEdits';
import {createServiceId, createServiceItemId} from '@core/schema/ids';

vi.mock('@renderer/app/workspaces/serviceOrderPanel', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@renderer/app/workspaces/serviceOrderPanel')
  >()),
  serviceOrderParts: vi.fn(() => ({})),
}));

function setup() {
  const fixture = itemFixture();
  const previousShow = useShow.getState();
  useShow.setState({
    serviceId: fixture.service().service.id,
    rows: [{kind: 'bible', id: 'bible-item', title: 'Bible'}],
  });
  onTestFinished(() => useShow.setState(previousShow));
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  onTestFinished(() => {
    items.dispose();
    return editor.dispose();
  });
  const onServiceItemOpen = vi.fn();
  const onOpenPrep = vi.fn();
  const onProblem = vi.fn();
  const {result} = renderHook(() =>
    usePrepPanels({
      prep: {api: fixture.api, editor, items, onServiceItemOpen},
      sizeClass: 'normal',
      onProblem,
      onOpenPrep,
      onShowInLibrary: undefined,
    }),
  );
  return {
    fixture,
    editor,
    items,
    onOpenPrep,
    onProblem,
    onServiceItemOpen,
    result,
  };
}

describe('usePrepPanels', () => {
  it.each(['library', 'item'])(
    'guards returning to the table from the inline %s editor',
    async source => {
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
      const panel = result.current.partsOf('편집').embedded;
      if (!isValidElement<{onBack?: () => void}>(panel)) {
        throw new Error('Missing editor');
      }
      act(() => panel.props.onBack?.());
      await waitFor(() => expect(leave).toHaveBeenCalledOnce());
      expect(open).not.toHaveBeenCalled();
      act(() => proceed?.());
      await waitFor(() => expect(open).toHaveBeenCalledExactlyOnceWith(null));
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

  it('waits for the leave guard and queued item edits before switching the navigator', async () => {
    const {fixture, editor, items, onOpenPrep, result} = setup();
    act(() => editor.open(fixture.first));
    let allowLeave: (() => void) | undefined;
    let finishFlush: ((saved: boolean) => void) | undefined;
    vi.spyOn(editor, 'requestLeave').mockImplementation(action => {
      allowLeave = action;
    });
    vi.spyOn(items, 'flushDrafts').mockReturnValue(
      new Promise(resolve => {
        finishFlush = resolve;
      }),
    );
    result.current.partsOf(SERVICE_ORDER);
    const navigate =
      vi.mocked(serviceOrderParts).mock.lastCall?.[0].onNavigateEditor;
    act(() => navigate?.('next-item', 'song'));
    expect(onOpenPrep).not.toHaveBeenCalled();
    expect(items.flushDrafts).toHaveBeenCalledOnce();
    expect(allowLeave).toBeUndefined();
    await act(async () => finishFlush?.(true));
    expect(onOpenPrep).not.toHaveBeenCalled();
    act(() => allowLeave?.());
    expect(onOpenPrep).toHaveBeenCalledExactlyOnceWith('next-item');
  });

  it.each(['false', 'reject'] as const)(
    'reports a %s flush and stays on the item',
    async failure => {
      const {fixture, editor, items, onProblem, onOpenPrep, result} = setup();
      act(() => editor.open(fixture.first));
      vi.spyOn(editor, 'requestLeave').mockImplementation(action => action());
      if (failure === 'false') {
        vi.spyOn(items, 'flushDrafts').mockResolvedValue(false);
      } else {
        vi.spyOn(items, 'flushDrafts').mockRejectedValue(new Error('failed'));
      }
      const log = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      result.current.partsOf(SERVICE_ORDER);
      const navigate =
        vi.mocked(serviceOrderParts).mock.lastCall?.[0].onNavigateEditor;
      await act(async () => navigate?.('next', 'song'));
      expect(onOpenPrep).not.toHaveBeenCalled();
      expect(editor.getSnapshot().session).not.toBeNull();
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({key: 'prep:flush', kind: 'warning'}),
      );
      log.mockRestore();
    },
  );

  it('ignores the earlier of two navigator switches when flushes finish out of order', async () => {
    const {fixture, editor, items, onOpenPrep, result} = setup();
    act(() => editor.open(fixture.first));
    vi.spyOn(editor, 'requestLeave').mockImplementation(action => action());
    const finish: Array<(saved: boolean) => void> = [];
    vi.spyOn(items, 'flushDrafts').mockImplementation(
      () => new Promise(resolve => finish.push(resolve)),
    );
    result.current.partsOf(SERVICE_ORDER);
    const navigate =
      vi.mocked(serviceOrderParts).mock.lastCall?.[0].onNavigateEditor;
    act(() => {
      navigate?.('first', 'song');
      navigate?.('second', 'song');
    });
    await act(async () => finish[1]?.(true));
    await act(async () => finish[0]?.(true));
    expect(onOpenPrep).toHaveBeenCalledExactlyOnceWith('second');
  });

  it.each(['removed', 'service changed'] as const)(
    'closes another item editor when its item is %s',
    async change => {
      const {result} = setup();
      result.current.partsOf(SERVICE_ORDER);
      const openOther =
        vi.mocked(serviceOrderParts).mock.lastCall?.[0].onOpenOther;
      await act(async () => openOther?.('bible-item'));
      expect(result.current.columns[1]).toEqual(['편집']);
      act(() =>
        useShow.setState(change === 'removed' ? {rows: []} : {serviceId: null}),
      );
      await waitFor(() =>
        expect(result.current.columns[1]).toEqual([SERVICE_ORDER]),
      );
    },
  );

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
    expect(result.current.columns[2]).toEqual(['슬라이드 속성']);
    const panel = result.current.partsOf('슬라이드 속성').embedded;
    expect(isValidElement(panel) && panel.type === SlideInspector).toBe(true);
    act(() => editor.open(null));
    await waitFor(() => expect(result.current.columns).toEqual(columns));
  });

  it('mounts the other-item inspector for a Bible or media editor', async () => {
    const {result} = setup();
    result.current.partsOf(SERVICE_ORDER);
    const openOther =
      vi.mocked(serviceOrderParts).mock.lastCall?.[0].onOpenOther;
    await act(async () => openOther?.('bible-item'));
    expect(result.current.columns[2]).toEqual(['슬라이드 속성']);
    const panel = result.current.partsOf('슬라이드 속성').embedded;
    expect(isValidElement(panel) && panel.type === OtherSlideInspector).toBe(
      true,
    );
  });

  it('draws the 예배 순서 as the table, not the plain list', () => {
    const {fixture, result} = setup();
    result.current.partsOf(SERVICE_ORDER);

    expect(vi.mocked(serviceOrderParts).mock.lastCall?.[0].table?.api).toBe(
      fixture.api,
    );
  });

  it('keeps the slide editor open and reports a failed slide flush', async () => {
    const fixture = itemFixture();
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    const onProblem = vi.fn();
    const onOpenPrep = vi.fn();
    const target = {
      serviceId: createServiceId('00000000-0000-4000-8000-000000000013'),
      itemId: createServiceItemId('00000000-0000-4000-8000-000000000012'),
    };
    const item = newSlidesItem('blank', target.itemId);
    const requestLeave = vi.spyOn(editor, 'requestLeave');
    const {result, unmount} = renderHook(() => {
      const model = useSlidesEditor(fixture.api, onProblem);
      const session = model.sessionFor(item, target);
      return usePrepPanels({
        prep: {
          api: fixture.api,
          editor,
          items,
          slides: {
            ...model,
            session,
            draft: session.draft,
            flush: async () => false,
          },
        },
        sizeClass: 'normal',
        onProblem,
        onOpenPrep,
        onShowInLibrary: undefined,
      });
    });
    result.current.partsOf(SERVICE_ORDER);
    const navigate =
      vi.mocked(serviceOrderParts).mock.lastCall?.[0].onNavigateEditor;
    await act(async () => navigate?.('next', 'song'));
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({key: 'prep:flush'}),
    );
    expect(requestLeave).not.toHaveBeenCalled();
    expect(onOpenPrep).not.toHaveBeenCalled();
    expect(result.current.columns[1]).toEqual(['편집']);
    unmount();
    items.dispose();
    return editor.dispose();
  });

  it('mounts the slide-item inspector for a slide draft', () => {
    const fixture = itemFixture();
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    const report = vi.fn();
    const itemId = createServiceItemId('00000000-0000-4000-8000-000000000012');
    const item = newSlidesItem('blank', itemId);
    const target = {
      serviceId: createServiceId('00000000-0000-4000-8000-000000000013'),
      itemId,
    };
    const {result, unmount} = renderHook(() => {
      const model = useSlidesEditor(fixture.api, report);
      const session = model.sessionFor(item, target);
      return usePrepPanels({
        prep: {
          api: fixture.api,
          editor,
          items,
          slides: {...model, session, draft: session.draft},
        },
        sizeClass: 'normal',
        onProblem: undefined,
        onOpenPrep: undefined,
        onShowInLibrary: undefined,
      });
    });
    expect(result.current.columns[2]).toEqual(['슬라이드 속성']);
    const panel = result.current.partsOf('슬라이드 속성').embedded;
    expect(isValidElement(panel) && panel.type === SlidesInspector).toBe(true);
    unmount();
    items.dispose();
    return editor.dispose();
  });
});
