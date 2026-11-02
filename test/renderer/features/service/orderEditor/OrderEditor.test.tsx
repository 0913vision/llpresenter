import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {
  ServiceDocument,
  SongDocument,
} from '@core/schema/contentDocuments';
import {createSongGroupId} from '@core/schema/ids';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import type {Label} from '@core/schema/labels';
import {isItemOfKind, parseService} from '@core/schema/service';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {sampleGroupedSong} from '@fixtures/core/songs/blockFixtures';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {OrderEditor} from '@renderer/features/service/orderEditor/OrderEditor';

const SERVICE_ID = '30000000-0000-4000-8000-000000000001';
const ITEM_ID = '40000000-0000-4000-8000-000000000001';
const VERSE = createSongGroupId('11111111-1111-4111-a111-111111111111');
const CHORUS = createSongGroupId('22222222-2222-4222-a222-222222222222');
const LABELS: readonly Label[] = [{name: '후렴', color: 'orange', key: null}];

function serviceWith(extra: object): ServiceDocument {
  const {data} = expectSuccess(
    parseService(
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: SERVICE_ID,
        name: '주일 예배',
        date: '2026-11-01T11:00',
        order: [
          {
            id: ITEM_ID,
            song: sampleGroupedSong().id,
            ...extra,
          },
        ],
      }),
      'memory.llservice',
    ),
  );
  return {service: data, revision: 4, access: 'editable'};
}

function itemOf(document: ServiceDocument) {
  const [item] = document.service.order;
  if (!item || !isItemOfKind(item, 'song')) throw new Error('Not a song');
  return item;
}

const songDocument: SongDocument = {
  song: sampleGroupedSong(),
  revision: 7,
  access: 'editable',
};

const edit = vi.fn<(request: ContentEdit) => Promise<EditResult>>();
const openSongEditor = vi.fn();
const onProblem = vi.fn();
const reloadSong = vi.fn();

function mountEditor(
  options: {
    readonly extra?: object;
    readonly serviceReadOnly?: boolean;
  } = {},
) {
  const document = serviceWith(options.extra ?? {});
  const api = mockLlpApi({
    services: {get: () => Promise.resolve(document)},
    content: {edit},
    window: {openSongEditor},
  });
  window.llp = api;
  return render(
    <OrderEditor
      api={api}
      target={{
        serviceId: document.service.id,
        itemId: itemOf(document).id,
      }}
      item={itemOf(document)}
      document={songDocument}
      serviceReadOnly={options.serviceReadOnly ?? false}
      labels={LABELS}
      onProblem={onProblem}
      reloadSong={reloadSong}
    />,
  );
}

beforeEach(() => {
  edit.mockReset();
  edit.mockResolvedValue({ok: true, value: {id: SERVICE_ID, revision: 5}});
  openSongEditor.mockReset();
  openSongEditor.mockResolvedValue({ok: true, value: undefined});
  onProblem.mockReset();
  reloadSong.mockReset();
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

function serviceUpdate(call: number) {
  const request = edit.mock.calls[call]?.[0];
  if (request?.type !== 'service.update') {
    throw new Error('Expected a service update');
  }
  const [item] = request.service.order;
  if (!item || !isItemOfKind(item, 'song')) throw new Error('Not a song');
  return item;
}

function songUpdate(call: number) {
  const request = edit.mock.calls[call]?.[0];
  if (request?.type !== 'song.update') {
    throw new Error('Expected a song update');
  }
  return request;
}

function savedOrder(): unknown {
  return serviceUpdate(edit.mock.calls.length - 1).customOrder;
}

function chipAt(listbox: string, index: number): HTMLElement {
  const chip = within(
    screen.getByRole('listbox', {name: listbox}),
  ).getAllByRole('option')[index];
  if (chip === undefined) throw new Error('Missing chip');
  return chip;
}

describe('OrderEditor', () => {
  it('shows the song, its played order, and the slide count', () => {
    mountEditor({extra: {customOrder: [CHORUS, VERSE]}});

    expect(screen.getByRole('heading').textContent).toBe(
      sampleGroupedSong().title,
    );
    const order = screen.getByRole('listbox', {name: '순서'});
    expect(
      within(order)
        .getAllByRole('option')
        .map(chip => chip.textContent),
    ).toEqual(['후렴', '1절']);
    expect(screen.getByText('슬라이드 3개')).toBeTruthy();
  });

  it('adds a group from the 이름표 row to the end of the order', async () => {
    mountEditor({extra: {customOrder: [VERSE]}});
    const palette = screen.getByRole('listbox', {name: '이름표'});
    fireEvent.click(within(palette).getByRole('option', {name: /후렴/}));

    await waitFor(() => expect(savedOrder()).toEqual([VERSE, CHORUS]));
  });

  it('removes a group from the order with Delete', async () => {
    mountEditor({extra: {customOrder: [VERSE, CHORUS]}});
    chipAt('순서', 0).focus();
    await userEvent.keyboard('{Delete}');

    await waitFor(() => expect(savedOrder()).toEqual([CHORUS]));
  });

  it('keeps every control locked for a read-only file', () => {
    mountEditor({serviceReadOnly: true});

    expect(
      screen
        .getByRole('button', {name: '구성으로 저장…'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.click(chipAt('이름표', 0));
    expect(edit).not.toHaveBeenCalled();
  });

  it('opens 곡 편집 for the song and reports a refusal', async () => {
    openSongEditor.mockResolvedValue({
      ok: false,
      error: {reason: 'not-implemented'},
    });
    mountEditor();
    fireEvent.click(screen.getByRole('button', {name: '곡 편집…'}));

    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '곡 편집 창을 열 수 없음'}),
      ),
    );
    expect(openSongEditor).toHaveBeenCalledWith({
      songId: sampleGroupedSong().id,
    });
  });

  it('saves the order as a new 구성 and makes the item use it', async () => {
    mountEditor({extra: {customOrder: [CHORUS, VERSE]}});
    fireEvent.click(screen.getByRole('button', {name: '구성으로 저장…'}));
    fireEvent.click(screen.getByRole('button', {name: '확인'}));

    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
    const saved = songUpdate(0);
    expect(saved.baseRevision).toBe(7);
    expect(saved.song.arrangements?.at(-1)).toEqual({
      name: '구성 1',
      groups: [CHORUS, VERSE],
    });
    const item = serviceUpdate(1);
    expect(item.arrangement).toBe('구성 1');
    expect(item).not.toHaveProperty('customOrder');
  });

  it('does not change the item when the song could not be saved', async () => {
    edit.mockResolvedValue({
      ok: false,
      error: {reason: 'stale', message: 'changed'},
    });
    mountEditor({extra: {customOrder: [CHORUS]}});
    fireEvent.click(screen.getByRole('button', {name: '구성으로 저장…'}));
    fireEvent.click(screen.getByRole('button', {name: '확인'}));

    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '구성 저장 실패'}),
      ),
    );
    expect(edit).toHaveBeenCalledTimes(1);
    expect(reloadSong).toHaveBeenCalledOnce();
  });

  it('opens 곡 편집 at the slide of a tile menu', async () => {
    mountEditor({extra: {customOrder: [CHORUS, VERSE]}});
    fireEvent.contextMenu(chipAt('슬라이드', 0));
    fireEvent.click(await screen.findByRole('menuitem', {name: '곡 편집…'}));

    await waitFor(() =>
      expect(openSongEditor).toHaveBeenCalledWith({
        songId: sampleGroupedSong().id,
        block: 2,
      }),
    );
  });
  it('adds an 오버레이 from a tile menu and saves it with the item', async () => {
    mountEditor({extra: {customOrder: [CHORUS, VERSE]}});
    fireEvent.contextMenu(chipAt('슬라이드', 0));
    fireEvent.click(
      await screen.findByRole('menuitem', {name: '오버레이 추가…'}),
    );
    fireEvent.click(await screen.findByRole('button', {name: '적용'}));

    await waitFor(() =>
      expect(serviceUpdate(0).overlays?.[0]).toMatchObject({
        from: 1,
        content: {text: ''},
      }),
    );
  });
});
