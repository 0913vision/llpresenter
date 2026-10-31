import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import {
  createServiceId,
  createServiceItemId,
  createSongGroupId,
  createSongId,
} from '@core/schema/ids';
import {SONG_DRAG_MIME} from '@core/schema/songDrag';
import {emptyLiveState} from '@core/live/state';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {applyService, useShow} from '@renderer/session/show';
import {useHeaderRename} from '@renderer/session/headerRename';
import {useLive} from '@renderer/session/live';
import {ServiceOrderList} from './ServiceOrderList';
import {otherItemEntries} from '@renderer/features/service/items/quickAddItems';
import type {ServiceItem} from '@core/schema/service';

const serviceId = createServiceId('00000000-0000-4000-8000-000000000001');
const headerId = createServiceItemId('10000000-0000-4000-8000-000000000001');
const firstId = createServiceItemId('10000000-0000-4000-8000-000000000002');
const lastId = createServiceItemId('10000000-0000-4000-8000-000000000003');
const emptySectionId = createServiceItemId(
  '10000000-0000-4000-8000-000000000009',
);
const songId = createSongId('20000000-0000-4000-8000-000000000001');
const secondHeaderId = createServiceItemId(
  '10000000-0000-4000-8000-000000000004',
);

function setup(
  workspace: 'show' | 'prep' = 'show',
  readOnly = false,
  extra: {
    emptySection?: boolean;
    secondSection?: boolean;
    namedArrangement?: boolean;
    arrangement?: string;
    missingSong?: boolean;
  } = {},
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
        {
          id: firstId,
          song: songId,
          ...(extra.arrangement ? {arrangement: extra.arrangement} : {}),
        },
        {
          id: lastId,
          song: songId,
          ...(extra.arrangement ? {arrangement: extra.arrangement} : {}),
        },
        ...(extra.secondSection
          ? [{id: secondHeaderId, header: '마무리'}]
          : []),
        ...(extra.emptySection
          ? [{id: emptySectionId, header: '빈 구역'}]
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
            ? {kind: 'header', id: item.id, title: item.title}
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
  const api = mockLlpApi({
    services: {get: () => Promise.resolve(document)},
    live: {send},
    songs: {
      get: () =>
        Promise.resolve(
          extra.missingSong
            ? null
            : {
                song: {
                  format: 'llsong',
                  schemaVersion: 2,
                  id: songId,
                  title: 'Invented song',
                  arrangements: extra.namedArrangement
                    ? [
                        {
                          name: '짧은 구성',
                          groups: [
                            createSongGroupId(
                              '00000000-0000-4000-8000-000000000101',
                            ),
                          ],
                        },
                      ]
                    : [],
                  groups: [
                    {
                      id: createSongGroupId(
                        '00000000-0000-4000-8000-000000000101',
                      ),
                      name: '',
                      slides: [{lines: []}],
                    },
                  ],
                },
                revision: 1,
                access: 'editable',
              },
        ),
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
  const onShowInLibrary = vi.fn();
  const view = render(
    <ServiceOrderList
      workspace={workspace}
      onProblem={onProblem}
      onOpenPrep={onOpenPrep}
      onShowInLibrary={onShowInLibrary}
    />,
  );
  return {
    api,
    send,
    onProblem,
    onOpenPrep,
    onShowInLibrary,
    document: () => document,
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
  it.each([{key: 'ContextMenu'}, {key: 'F10', shiftKey: true}])(
    'marks the focused order row when $key opens its menu',
    keys => {
      setup();
      const row = screen.getByRole('option', {name: '첫 곡'});
      row.focus();
      fireEvent.keyDown(row, keys);
      expect(
        screen.getByRole('menu', {name: '예배 순서 항목 메뉴'}),
      ).toBeDefined();
      expect(row.hasAttribute('data-menu-target')).toBe(true);
      fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
      expect(row.hasAttribute('data-menu-target')).toBe(false);
    },
  );

  it('hands focus from a selected section context menu to its rename field', async () => {
    const {api} = setup('prep');
    const user = userEvent.setup();
    const section = screen.getByRole('option', {name: '제목'});
    await user.click(section);
    section.focus();
    expect(document.activeElement).toBe(section);
    const contextTarget = section;
    fireEvent.contextMenu(contextTarget);
    expect(contextTarget.hasAttribute('data-menu-target')).toBe(true);
    await user.click(
      await screen.findByRole('menuitem', {name: '이름 바꾸기'}),
    );
    const field = await screen.findByRole('textbox', {name: '제목 이름'});
    await waitFor(() => expect(document.activeElement).toBe(field));
    await user.clear(field);
    await user.type(field, '바뀐 구역{Enter}');
    await screen.findByRole('option', {name: '바뀐 구역'});
    expect(api.content.edit).toHaveBeenCalledTimes(1);
  });

  it('selects an empty section and keeps it when a dropped song is added below it', async () => {
    const {ids, send} = setup('prep', false, {emptySection: true});
    const target = screen.getByRole('option', {name: '빈 구역'});
    fireEvent.click(target);
    expect(useShow.getState().openItemId).toBe(emptySectionId);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 100, 200, 40),
    );
    const dataTransfer = transfer(JSON.stringify({kind: 'song', songId}));
    fireEvent.dragOver(target, {dataTransfer, clientY: 130});
    const drop = new MouseEvent('drop', {bubbles: true, clientY: 130});
    Object.defineProperty(drop, 'dataTransfer', {value: dataTransfer});
    fireEvent(target, drop);
    await waitFor(() => expect(ids()).toHaveLength(5));
    expect(ids().slice(0, 4)).toEqual([
      headerId,
      firstId,
      lastId,
      emptySectionId,
    ]);
    expect(
      screen.getByRole('option', {name: '빈 구역', selected: true}),
    ).toBeDefined();
    expect(useShow.getState().openItemId).toBe(emptySectionId);
    expect(send).not.toHaveBeenCalled();
  });

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

  it('ignores a delayed song read after another item menu opens', async () => {
    const {api} = setup();
    const document = await api.songs.get(songId);
    let finish: (value: typeof document) => void = () => undefined;
    const read = vi.spyOn(api.songs, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    const parent = await screen.findByRole('menuitem', {name: '구성'});
    await waitFor(() =>
      expect(parent.getAttribute('aria-disabled')).not.toBe('true'),
    );
    await act(async () => {
      finish(document);
    });
    expect(parent.getAttribute('aria-disabled')).not.toBe('true');
    await userEvent.hover(parent);
    expect(
      await screen.findByRole('menuitemradio', {name: '기본'}),
    ).toBeDefined();
  });

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

  it('drops above the first row from the list top padding', async () => {
    const {list, ids} = setup();
    const header = screen.getByRole('option', {name: '제목'});
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 4, 200, 30),
    );
    for (const [index, row] of screen.getAllByRole('option').entries()) {
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 34 + index * 30, 200, 30),
      );
    }
    const dataTransfer = transfer();
    fireEvent.dragStart(screen.getByRole('option', {name: '다음 곡'}), {
      dataTransfer,
    });
    const event = new Event('drop', {bubbles: true, cancelable: true});
    Object.defineProperties(event, {
      dataTransfer: {value: dataTransfer},
      clientY: {value: 2},
    });
    fireEvent(list(), event);
    await waitFor(() => expect(ids()).toEqual([lastId, headerId, firstId]));
  });

  it('does not select or output a row on the click after a native drag', () => {
    const {send} = setup();
    const before = useShow.getState().openItemId;
    const row = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.dragStart(row, {dataTransfer: transfer()});
    fireEvent.dragEnd(row);
    fireEvent.click(row, {detail: 1});
    expect(useShow.getState().openItemId).toBe(before);
    expect(send).not.toHaveBeenCalled();
    fireEvent.pointerDown(row);
    fireEvent.click(row, {detail: 1});
    expect(useShow.getState().openItemId).toBe(lastId);
  });

  it('does not rename a dragged header on a release double click', () => {
    setup('prep');
    const header = screen.getByText('제목');
    fireEvent.dragStart(header, {dataTransfer: transfer()});
    fireEvent.dragEnd(header);
    fireEvent.doubleClick(header, {detail: 2});
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.pointerDown(header);
    fireEvent.doubleClick(header, {detail: 2});
    expect(screen.getByRole('textbox', {name: '제목 이름'})).toBeDefined();
  });

  it.each([
    {y: 14, expected: [headerId, firstId, lastId, secondHeaderId]},
    {y: 15, expected: [secondHeaderId, headerId, firstId, lastId]},
    {y: 16, expected: [secondHeaderId, headerId, firstId, lastId]},
  ])(
    'moves a whole section across the target header midpoint at $y',
    async ({y, expected}) => {
      const {ids} = setup('prep', false, {secondSection: true});
      const target = screen.getByRole('option', {name: '마무리'});
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, 200, 30),
      );
      const dataTransfer = transfer();
      fireEvent.dragStart(screen.getByText('제목'), {dataTransfer});
      const event = new Event('drop', {bubbles: true, cancelable: true});
      Object.defineProperties(event, {
        dataTransfer: {value: dataTransfer},
        clientY: {value: y},
      });
      fireEvent(target, event);
      await waitFor(() => expect(ids()).toEqual(expected));
    },
  );

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
    const field = await screen.findByRole('textbox', {name: '제목 이름'});
    fireEvent.change(field, {target: {value: '   '}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(screen.getByText('제목')).toBeDefined();
    expect(api.content.edit).not.toHaveBeenCalled();
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    expect(await screen.findByRole('menuitem', {name: '삭제'})).toBeDefined();
    expect(screen.queryByRole('menuitem', {name: '이름 바꾸기'})).toBeNull();
  });

  it('selects the new section name for renaming while retaining the header kind', async () => {
    const {api} = setup('prep');
    const document = await api.services.get(serviceId);
    if (document === null) throw new Error('No fixture service');
    const inserted: ServiceItem[] = [];
    const entries = otherItemEntries({
      media: [],
      notices: [],
      onBible: () => undefined,
      onInsert: item => inserted.push(item),
    });
    const command = entries.find(
      entry => entry.kind === 'item' && entry.id === 'other:header',
    );
    if (command?.kind !== 'item') throw new Error('No section command');
    command.onSelect?.();
    const item = inserted[0];
    if (item === undefined) throw new Error('No inserted section');
    await act(async () => {
      await api.content.edit({
        type: 'service.update',
        service: {
          ...document.service,
          order: [...document.service.order, item],
        },
        baseRevision: document.revision,
      });
      useHeaderRename.getState().request(item.id);
    });
    expect(useShow.getState().rows.at(-1)?.kind).toBe('header');
    const field = screen.getByRole('textbox', {name: '새 구역 이름'});
    expect(field).toHaveProperty('value', '새 구역');
    expect(field).toHaveProperty('selectionStart', 0);
    expect(field).toHaveProperty('selectionEnd', '새 구역'.length);
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

  it('opens a song in prep through the host, without output', async () => {
    const {onOpenPrep, send} = setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '가사 편집'}),
    );
    expect(onOpenPrep).toHaveBeenCalledWith(lastId);
    expect(send).not.toHaveBeenCalled();
    expect(useShow.getState().openItemId).toBeNull();
  });

  it('lists the rows of the ProPresenter playlist item menu for a song', async () => {
    setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    const menu = await screen.findByRole('menu', {name: '예배 순서 항목 메뉴'});
    const rows = [
      ...menu.querySelectorAll('[role="menuitem"], [role="separator"]'),
    ].map(row =>
      row.getAttribute('role') === 'separator'
        ? '|'
        : (row.querySelector('[class*="label"]')?.textContent ?? ''),
    );
    expect(rows).toEqual([
      '항목 숨기기',
      '다른 예배에 추가',
      '|',
      '구성',
      '출력 대상',
      '|',
      '크기 바꾸기',
      '가사 편집',
      '|',
      '복사',
      '붙여넣기',
      '복제',
      '삭제',
      '|',
      '라이브러리에서 보기',
      '묶음으로 내보내기…',
      '그림으로 내보내기…',
    ]);
    for (const name of ['구성', '라이브러리에서 보기']) {
      await waitFor(() =>
        expect(
          screen.getByRole('menuitem', {name}).getAttribute('aria-disabled'),
        ).not.toBe('true'),
      );
    }
  });

  it('checks the item arrangement and changes only the clicked item through the setting writer', async () => {
    const fixture = setup('show', false, {
      namedArrangement: true,
      arrangement: '짧은 구성',
    });
    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    const parent = await screen.findByRole('menuitem', {name: '구성'});
    await waitFor(() =>
      expect(parent.getAttribute('aria-disabled')).not.toBe('true'),
    );
    await user.hover(parent);
    expect(
      (
        await screen.findByRole('menuitemradio', {name: '짧은 구성'})
      ).getAttribute('aria-checked'),
    ).toBe('true');
    await user.click(screen.getByRole('menuitemradio', {name: '기본'}));
    await waitFor(() =>
      expect(fixture.document().service.order[2]).not.toHaveProperty(
        'arrangement',
      ),
    );
    expect(fixture.document().service.order[1]).toHaveProperty(
      'arrangement',
      '짧은 구성',
    );
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    const next = await screen.findByRole('menuitem', {name: '구성'});
    await waitFor(() =>
      expect(next.getAttribute('aria-disabled')).not.toBe('true'),
    );
    await user.hover(next);
    expect(
      (await screen.findByRole('menuitemradio', {name: '기본'})).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    await user.click(screen.getByRole('menuitemradio', {name: '짧은 구성'}));
    await waitFor(() =>
      expect(fixture.document().service.order[2]).toHaveProperty(
        'arrangement',
        '짧은 구성',
      ),
    );
    expect(fixture.send).not.toHaveBeenCalled();
    expect(useShow.getState().openItemId).toBeNull();
  });

  it('keeps a single default arrangement selectable without writing an unchanged item', async () => {
    const {api, send} = setup();
    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    const parent = await screen.findByRole('menuitem', {name: '구성'});
    await waitFor(() =>
      expect(parent.getAttribute('aria-disabled')).not.toBe('true'),
    );
    await user.hover(parent);
    const only = await screen.findByRole('menuitemradio', {name: '기본'});
    expect(screen.getAllByRole('menuitemradio')).toEqual([only]);
    expect(only.getAttribute('aria-checked')).toBe('true');
    await user.click(only);
    expect(api.content.edit).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('disables both new rows when the song is missing', async () => {
    const {send, onShowInLibrary} = setup('show', false, {missingSong: true});
    await act(async () => {
      fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    });
    await userEvent.hover(screen.getByRole('menuitem', {name: '구성'}));
    expect(await screen.findByRole('tooltip')).toHaveProperty(
      'textContent',
      '곡 파일을 찾을 수 없습니다.',
    );
    for (const name of ['구성', '라이브러리에서 보기']) {
      expect(
        screen.getByRole('menuitem', {name}).getAttribute('aria-disabled'),
      ).toBe('true');
    }
    expect(onShowInLibrary).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['show', 'prep'] as const)(
    'reveals the song from %s even when its service is read-only',
    async workspace => {
      const {api, send, onShowInLibrary} = setup(workspace, true);
      fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
      const reveal = await screen.findByRole('menuitem', {
        name: '라이브러리에서 보기',
      });
      await waitFor(() =>
        expect(reveal.getAttribute('aria-disabled')).not.toBe('true'),
      );
      expect(
        screen
          .getByRole('menuitem', {name: '구성'})
          .getAttribute('aria-disabled'),
      ).toBe('true');
      await userEvent.click(reveal);
      expect(onShowInLibrary).toHaveBeenCalledExactlyOnceWith(songId);
      expect(api.content.edit).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('deletes the selected prep item with Delete and keeps focus for Ctrl Z', async () => {
    const {ids, send} = setup('prep');
    const user = userEvent.setup();
    const row = screen.getByRole('option', {name: '첫 곡'});
    await user.click(row);
    row.focus();
    await user.keyboard('{Delete}');
    await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: '제목'}),
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
