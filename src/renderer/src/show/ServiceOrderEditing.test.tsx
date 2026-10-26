import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ContentEdit, EditResult} from '@shared/schema/contentEdit';
import type {ServiceDocument} from '@shared/schema/contentDocuments';
import {
  createServiceId,
  createServiceItemId,
  createSongId,
} from '@shared/schema/ids';
import {SONG_DRAG_MIME} from '@shared/schema/songDrag';
import {emptyLiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {applyService, useShow} from '@renderer/state/show';
import {useHeaderRename} from '@renderer/state/headerRename';
import {useLive} from '@renderer/state/live';
import {ServiceOrderList} from './ServiceOrderList';

const serviceId = createServiceId('00000000-0000-4000-8000-000000000001');
const headerId = createServiceItemId('10000000-0000-4000-8000-000000000001');
const firstId = createServiceItemId('10000000-0000-4000-8000-000000000002');
const lastId = createServiceItemId('10000000-0000-4000-8000-000000000003');
const slotId = createServiceItemId('10000000-0000-4000-8000-000000000009');
const songId = createSongId('20000000-0000-4000-8000-000000000001');

function setup(
  workspace: 'show' | 'prep' = 'show',
  readOnly = false,
  withSlot = false,
) {
  let document: ServiceDocument = {
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: serviceId,
      name: 'Invented service',
      date: '2026-10-26T09:00',
      order: [
        {id: headerId, header: '제목'},
        {id: firstId, song: songId},
        {id: lastId, song: songId},
        ...(withSlot
          ? [{id: slotId, slot: 'song' as const, title: '찬양 자리'}]
          : []),
      ],
    },
    revision: 1,
    access: readOnly ? 'readOnly' : 'editable',
  };
  const publish = (): void =>
    applyService({
      id: serviceId,
      revision: document.revision,
      name: 'Invented service',
      readOnly,
      rows: document.service.order.map(item =>
        'header' in item
          ? {kind: 'header', id: item.id, title: item.header}
          : 'slot' in item
            ? {kind: 'slot', id: item.id, title: item.title, accepts: item.slot}
            : {
                kind: 'song',
                id: item.id,
                title: item.id === firstId ? '첫 곡' : '다음 곡',
              },
      ),
      tiles: {},
      jumpKeys: {},
    });
  const send = vi.fn();
  const api = fakeLlpApi({
    services: {get: () => Promise.resolve(document)},
    live: {send},
    songs: {
      get: () =>
        Promise.resolve({
          song: {
            format: 'llsong',
            schemaVersion: 1,
            id: songId,
            title: 'Invented song',
            slides: [{lines: []}],
          },
          revision: 1,
          access: 'editable',
        }),
    },
    content: {
      edit: vi.fn((command: ContentEdit): Promise<EditResult> => {
        if (command.type !== 'service.update') {
          throw new Error('Unexpected command');
        }
        document = {
          ...document,
          service: command.service,
          revision: document.revision + 1,
        };
        publish();
        return Promise.resolve({
          ok: true,
          value: {id: serviceId, revision: document.revision},
        });
      }),
    },
  });
  window.llp = api;
  publish();
  const onProblem = vi.fn();
  const onOpenPrep = vi.fn();
  const view = render(
    <ServiceOrderList
      workspace={workspace}
      onProblem={onProblem}
      onOpenPrep={onOpenPrep}
    />,
  );
  return {
    api,
    send,
    onProblem,
    onOpenPrep,
    view,
    ids: () => document.service.order.map(item => item.id),
    list: () => screen.getByRole('listbox', {name: '예배 순서'}),
  };
}

function transfer(payload = '') {
  return {
    types: payload === '' ? [] : [SONG_DRAG_MIME],
    effectAllowed: 'none',
    dropEffect: 'none',
    setData: vi.fn(),
    getData: () => payload,
  };
}

beforeEach(() => {
  applyService(null);
  useLive.setState({state: null, lastSlideItemId: null});
});

describe('service panel editing', () => {
  it('shows the chosen arrangement count in prep and refreshes it with the projection', () => {
    const {view, onProblem} = setup('prep');
    expect(screen.getAllByText('슬라이드 0개')).toHaveLength(2);
    act(() =>
      useShow.setState({
        tiles: {
          [firstId]: [
            {label: null, labelColor: 'none', lines: ['Invented words']},
            {
              label: null,
              labelColor: 'none',
              lines: ['Repeated arrangement slide'],
            },
          ],
        },
      }),
    );
    expect(screen.getByText('슬라이드 2개')).toBeDefined();
    view.rerender(<ServiceOrderList workspace="show" onProblem={onProblem} />);
    expect(screen.queryByText('슬라이드 2개')).toBeNull();
  });

  it.each(['show', 'prep'] as const)(
    'deletes and undoes in %s without touching live output',
    async workspace => {
      const {api, send, list, ids} = setup(workspace);
      const user = userEvent.setup();
      const base = emptyLiveState();
      act(() =>
        useLive.setState({
          state: {
            ...base,
            layers: {
              ...base.layers,
              slide: {
                itemId: firstId,
                position: 0,
                label: null,
                lines: ['Kept live'],
              },
            },
          },
        }),
      );
      fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
      await user.click(await screen.findByRole('menuitem', {name: '삭제'}));
      await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
      fireEvent.keyDown(list(), {key: 'ㅋ', code: 'KeyZ', ctrlKey: true});
      await screen.findByRole('option', {name: '첫 곡'});
      fireEvent.keyDown(list(), {key: 'ㅛ', code: 'KeyY', ctrlKey: true});
      await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
      expect(api.content.edit).toHaveBeenCalledTimes(3);
      expect(useLive.getState().state?.layers.slide?.lines).toEqual([
        'Kept live',
      ]);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('keeps edit history when the list remounts for another workspace', async () => {
    const {view, ids, list} = setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await userEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
    view.unmount();
    render(<ServiceOrderList workspace="prep" />);
    fireEvent.keyDown(list(), {key: 'z', code: 'KeyZ', ctrlKey: true});
    await screen.findByRole('option', {name: '첫 곡'});
  });

  it('reorders songs and headers, using the list tail to append', async () => {
    const {api, send, list, ids} = setup();
    const dataTransfer = transfer();
    fireEvent.dragStart(screen.getByRole('option', {name: '다음 곡'}), {
      dataTransfer,
    });
    fireEvent.dragOver(screen.getByText('제목'), {dataTransfer});
    expect(dataTransfer.dropEffect).toBe('move');
    fireEvent.drop(screen.getByText('제목'), {dataTransfer});
    await waitFor(() => expect(ids()).toEqual([lastId, headerId, firstId]));
    fireEvent.dragStart(screen.getByText('제목'), {dataTransfer});
    fireEvent.drop(list(), {dataTransfer});
    await waitFor(() => expect(ids()).toEqual([lastId, headerId, firstId]));
    expect(api.content.edit).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('renames a header in place with a double click, Enter, Esc, and leaving the field', async () => {
    const {api, ids, send} = setup();
    fireEvent.doubleClick(screen.getByText('제목'));
    const field = screen.getByRole('textbox', {name: '제목 이름'});
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, {target: {value: '  말씀  '}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() => expect(screen.getByText('말씀')).toBeDefined());
    expect(ids()).toEqual([headerId, firstId, lastId]);
    fireEvent.doubleClick(screen.getByText('말씀'));
    fireEvent.change(screen.getByRole('textbox', {name: '말씀 이름'}), {
      target: {value: '버림'},
    });
    fireEvent.keyDown(screen.getByRole('textbox', {name: '말씀 이름'}), {
      key: 'Escape',
    });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('말씀')).toBeDefined();
    fireEvent.doubleClick(screen.getByText('말씀'));
    const again = screen.getByRole('textbox', {name: '말씀 이름'});
    fireEvent.change(again, {target: {value: '마무리'}});
    fireEvent.blur(again);
    await waitFor(() => expect(screen.getByText('마무리')).toBeDefined());
    expect(api.content.edit).toHaveBeenCalledTimes(2);
    expect(send).not.toHaveBeenCalled();
  });

  it('leaves text editing keys to the rename field', async () => {
    const {api, ids} = setup('prep');
    fireEvent.click(screen.getByRole('option', {name: '첫 곡'}));
    fireEvent.doubleClick(screen.getByText('제목'));
    const field = screen.getByRole('textbox', {name: '제목 이름'});
    for (const key of [
      {code: 'KeyZ', key: 'z', ctrlKey: true},
      {code: 'KeyY', key: 'y', ctrlKey: true},
      {code: 'Delete', key: 'Delete'},
      {code: 'Home', key: 'Home'},
      {code: 'End', key: 'End'},
    ]) {
      fireEvent.keyDown(field, key);
      expect(document.activeElement).toBe(field);
    }
    expect(api.content.edit).not.toHaveBeenCalled();
    expect(ids()).toEqual([headerId, firstId, lastId]);
    expect(
      screen.getByRole('option', {name: '첫 곡'}).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('still lets window commands such as Ctrl L and the F keys through the rename field', () => {
    setup('prep');
    fireEvent.doubleClick(screen.getByText('제목'));
    const field = screen.getByRole('textbox', {name: '제목 이름'});
    const reached: string[] = [];
    const listener = (event: KeyboardEvent): void => {
      reached.push(event.code);
    };
    window.addEventListener('keydown', listener);
    fireEvent.keyDown(field, {code: 'KeyL', key: 'l', ctrlKey: true});
    fireEvent.keyDown(field, {code: 'F2', key: 'F2'});
    fireEvent.keyDown(field, {code: 'KeyZ', key: 'z', ctrlKey: true});
    fireEvent.keyDown(field, {code: 'Home', key: 'Home'});
    window.removeEventListener('keydown', listener);
    expect(reached).toEqual(['KeyL', 'F2']);
  });

  it('opens the rename field only from the header itself, not from its items', () => {
    setup('prep');
    fireEvent.doubleClick(screen.getByRole('option', {name: '첫 곡'}));
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.doubleClick(screen.getByText('제목'));
    expect(screen.getByRole('textbox', {name: '제목 이름'})).toBeDefined();
  });

  it('keeps the old name for a blank one and opens the field from the menu', async () => {
    const {api} = setup();
    fireEvent.contextMenu(screen.getByText('제목'));
    fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
    const field = screen.getByRole('textbox', {name: '제목 이름'});
    fireEvent.change(field, {target: {value: '   '}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(screen.getByText('제목')).toBeDefined();
    expect(api.content.edit).not.toHaveBeenCalled();
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    expect(await screen.findByRole('menuitem', {name: '삭제'})).toBeDefined();
    expect(screen.queryByRole('menuitem', {name: '이름 바꾸기'})).toBeNull();
  });

  it('opens the field of a header that quick add asked for once it is listed', async () => {
    setup();
    useHeaderRename
      .getState()
      .request(createServiceItemId('10000000-0000-4000-8000-0000000000aa'));
    expect(screen.queryByRole('textbox')).toBeNull();
    act(() => useHeaderRename.getState().request(headerId));
    expect(screen.getByRole('textbox', {name: '제목 이름'})).toBeDefined();
    fireEvent.keyDown(screen.getByRole('textbox', {name: '제목 이름'}), {
      key: 'Escape',
    });
    expect(useHeaderRename.getState().requested).toBeNull();
  });

  it('does not rename in a read-only service', () => {
    setup('show', true);
    fireEvent.doubleClick(screen.getByText('제목'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('fills a song slot with a dropped library song, keeping its place and its selection', async () => {
    const {api, ids, send} = setup('prep', false, true);
    const target = screen.getByRole('option', {name: '찬양 자리'});
    fireEvent.click(target);
    expect(useShow.getState().openItemId).toBe(slotId);
    const dataTransfer = transfer(JSON.stringify({kind: 'song', songId}));
    fireEvent.dragOver(target, {dataTransfer});
    expect(dataTransfer.dropEffect).toBe('copy');
    fireEvent.drop(target, {dataTransfer});
    await waitFor(() =>
      expect(screen.queryByRole('option', {name: '찬양 자리'})).toBeNull(),
    );
    expect(ids()).toEqual([headerId, firstId, lastId, slotId]);
    expect(useShow.getState().openItemId).toBe(slotId);
    expect(
      screen.getByRole('option', {name: '다음 곡', selected: true}),
    ).toBeDefined();
    expect(api.content.edit).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('copies validated library song drops and ignores unrelated or malformed data', async () => {
    const {api, send, ids} = setup('prep');
    const target = screen.getByRole('option', {name: '첫 곡'});
    fireEvent.drop(target, {dataTransfer: transfer('not json')});
    fireEvent.drop(target, {dataTransfer: transfer()});
    expect(api.content.edit).not.toHaveBeenCalled();
    const dataTransfer = transfer(JSON.stringify({kind: 'song', songId}));
    fireEvent.dragOver(target, {dataTransfer});
    expect(dataTransfer.dropEffect).toBe('copy');
    fireEvent.drop(target, {dataTransfer});
    await waitFor(() => expect(ids()).toHaveLength(4));
    expect(ids()[1]).not.toBe(firstId);
    expect(send).not.toHaveBeenCalled();
  });

  it('disables read-only deletion and drops', async () => {
    const {api} = setup('show', true);
    const target = screen.getByRole('option', {name: '첫 곡'});
    fireEvent.contextMenu(target);
    expect(
      (await screen.findByRole('menuitem', {name: '삭제'})).getAttribute(
        'aria-disabled',
      ),
    ).toBe('true');
    fireEvent.drop(target, {
      dataTransfer: transfer(JSON.stringify({kind: 'song', songId})),
    });
    expect(api.content.edit).not.toHaveBeenCalled();
  });

  it('hands failures to the host and leaves the visible projection unchanged', async () => {
    const {api, onProblem, ids} = setup();
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed'},
    });
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await userEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({key: 'service-order:stale'}),
      ),
    );
    expect(ids()).toEqual([headerId, firstId, lastId]);
  });

  it('opens the selected item in prep through the host, without output', async () => {
    const {onOpenPrep, send} = setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '준비에서 열기'}),
    );
    expect(onOpenPrep).toHaveBeenCalledWith(lastId);
    expect(send).not.toHaveBeenCalled();
    expect(useShow.getState().openItemId).toBeNull();
  });

  it('deletes the selected prep item with Delete and keeps focus for Ctrl Z', async () => {
    const {ids, send} = setup('prep');
    const user = userEvent.setup();
    const row = screen.getByRole('option', {name: '첫 곡'});
    await user.click(row);
    row.focus();
    await user.keyboard('{Delete}');
    await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: '다음 곡'}),
    );
    await user.keyboard('{Control>}z{/Control}');
    await screen.findByRole('option', {name: '첫 곡'});
    expect(send).not.toHaveBeenCalled();
  });

  it('logs the cause of a local edit-dispatch failure and reports it to the host', async () => {
    const {api, onProblem} = setup();
    const log = vi.spyOn(api.log, 'write');
    act(() => useShow.setState({serviceId: 'invalid-id'}));
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await userEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(log.mock.calls[0]?.[0].message).toBe(
      'Could not edit the service order',
    );
    expect(log.mock.calls[0]?.[0].detail).toBeTruthy();
  });
});
