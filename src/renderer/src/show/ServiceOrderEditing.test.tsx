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
import {useLive} from '@renderer/state/live';
import {ServiceOrderList} from './ServiceOrderList';

const serviceId = createServiceId('00000000-0000-4000-8000-000000000001');
const headerId = createServiceItemId('10000000-0000-4000-8000-000000000001');
const firstId = createServiceItemId('10000000-0000-4000-8000-000000000002');
const lastId = createServiceItemId('10000000-0000-4000-8000-000000000003');
const songId = createSongId('20000000-0000-4000-8000-000000000001');

function setup(workspace: 'show' | 'prep' = 'show', readOnly = false) {
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
        item.id === headerId
          ? {kind: 'header', id: item.id, title: '제목'}
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
      fireEvent.keyDown(list(), {key: 'z', ctrlKey: true});
      await screen.findByRole('option', {name: '첫 곡'});
      fireEvent.keyDown(list(), {key: 'y', ctrlKey: true});
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
    fireEvent.keyDown(list(), {key: 'z', ctrlKey: true});
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
    await waitFor(() => expect(ids()).toEqual([lastId, firstId, headerId]));
    expect(api.content.edit).toHaveBeenCalledTimes(2);
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
});
