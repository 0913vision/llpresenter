import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import {
  createServiceId,
  createServiceItemId,
  createSongId,
} from '@core/schema/ids';
import {createDefaultThemes} from '@core/themes/defaults';
import type {SongChange, SongDocument} from '@core/schema/contentDocuments';
import {sampleSong} from '@fixtures/core/songs/blockFixtures';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {ServiceTableList} from '@renderer/features/service/table/ServiceTableList';
import {useLive} from '@renderer/session/live';
import {applyService} from '@renderer/session/show';

const SERVICE_ID = createServiceId('00000000-0000-4000-8000-000000000001');
const SONG_ITEM = createServiceItemId('10000000-0000-4000-8000-000000000002');
const SONG_ID = createSongId('20000000-0000-4000-8000-000000000001');

function setup() {
  const document: ServiceDocument = {
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: SERVICE_ID,
      name: 'Invented service',
      date: '2026-11-02T11:00',
      order: [{slides: [], id: SONG_ITEM, song: SONG_ID, memo: '간주 길게'}],
    },
    revision: 1,
    access: 'editable',
  };
  applyService({
    id: SERVICE_ID,
    revision: 1,
    name: 'Invented service',
    readOnly: false,
    rows: [{kind: 'song', id: SONG_ITEM, title: '첫 곡'}],
    tiles: {},
    jumpKeys: {},
  });
  const edits: ContentEdit[] = [];
  const songDocument: SongDocument = {
    song: {
      ...sampleSong(),
      id: SONG_ID,
    },
    revision: 1,
    access: 'editable',
  };
  const songListeners = new Set<(change: SongChange) => void>();
  const api = mockLlpApi({
    services: {get: () => Promise.resolve(document)},
    songs: {
      get: () => Promise.resolve(songDocument),
      subscribe: listener => {
        songListeners.add(listener);
        return () => songListeners.delete(listener);
      },
    },
    settings: {
      get: ({name}) =>
        Promise.resolve(
          name === 'themes'
            ? settingsDocument('themes', createDefaultThemes())
            : name === 'macros'
              ? settingsDocument('macros', {macros: [], collections: []})
              : settingsDocument(name, {}),
        ),
    },
    content: {
      edit: vi.fn(async (command: ContentEdit): Promise<EditResult> => {
        edits.push(command);
        return {ok: true, value: {id: SERVICE_ID, revision: 2}};
      }),
    },
  });
  window.llp = api;
  render(
    <ServiceTableList
      api={api}
      items={{submitItemEdit: vi.fn(async () => true)}}
      onProblem={vi.fn()}
    />,
  );
  return {edits};
}

beforeEach(() => {
  useLive.setState({state: null});
});

afterEach(() => {
  cleanup();
  applyService(null);
  delete window.llp;
});

it('draws one row per item under the column names, without the plain count', async () => {
  setup();

  const row = await screen.findByRole('option', {name: '첫 곡'});
  expect(await screen.findByText('간주 길게')).toBeDefined();
  for (const name of ['슬라이드', '테마', '배경', '시작할 때', '메모']) {
    expect(screen.getAllByText(name).length).toBeGreaterThan(0);
  }
  expect(row.textContent).not.toContain('슬라이드 0개');
});

it('shows 항목 없음 and keeps the adders for a service with no items', async () => {
  setup();
  await screen.findByRole('option', {name: '첫 곡'});
  expect(screen.queryByRole('status')).toBeNull();

  act(() =>
    applyService({
      id: SERVICE_ID,
      revision: 2,
      name: 'Invented service',
      readOnly: false,
      rows: [],
      tiles: {},
      jumpKeys: {},
    }),
  );

  expect((await screen.findByRole('status')).textContent).toBe('항목 없음');
  expect(screen.getByRole('button', {name: '항목'})).toBeDefined();
  expect(screen.getByRole('button', {name: '구역'})).toBeDefined();
});

it('shows 예배 없음 with 새 예배… and no adders when no service is open', async () => {
  setup();
  await screen.findByRole('option', {name: '첫 곡'});

  act(() => applyService(null));

  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('예배 없음'),
  );
  expect(screen.queryByRole('button', {name: '항목'})).toBeNull();
  expect(screen.queryByRole('button', {name: '구역'})).toBeNull();
  await userEvent.click(screen.getByRole('button', {name: '새 예배…'}));
  expect(await screen.findByRole('dialog', {name: /새 예배/})).toBeDefined();
});

it('adds a 구역 at the end of the table', async () => {
  const {edits} = setup();
  await screen.findByRole('option', {name: '첫 곡'});

  await userEvent.click(screen.getByRole('button', {name: '구역'}));

  await waitFor(() => expect(edits).toHaveLength(1));
  const [command] = edits;
  if (command?.type !== 'service.update') throw new Error('Expected an update');
  expect(command.service.order.map(item => item.id)[0]).toBe(SONG_ITEM);
  expect(command.service.order).toHaveLength(2);
  expect('header' in (command.service.order[1] ?? {})).toBe(true);
});

it('moves from a row into its cells with ArrowRight, opens a cell with Enter, and goes back with Esc', async () => {
  const {edits} = setup();
  const row = await screen.findByRole('option', {name: '첫 곡'});
  await screen.findByRole('button', {name: /^메모, /});
  row.focus();

  await userEvent.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: /^테마, /}),
  );
  await userEvent.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: /^배경, /}),
  );
  await userEvent.keyboard('{ArrowLeft}');
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: /^테마, /}),
  );

  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('menu')).toBeDefined();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

  screen.getByRole('button', {name: /^메모, /}).focus();
  await userEvent.keyboard('{Delete}');
  expect(edits).toHaveLength(0);
  await userEvent.keyboard('{Escape}');
  expect(document.activeElement).toBe(row);
});

it('types a memo with spaces and arrow keys without the row taking them', async () => {
  setup();
  const row = await screen.findByRole('option', {name: '첫 곡'});
  await screen.findByRole('button', {name: /^메모, /});
  row.focus();
  expect(row.getAttribute('aria-selected')).toBe('false');
  await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
  await userEvent.keyboard('{Enter}');
  const field = await screen.findByRole('textbox', {name: /^메모, /});
  const selected = row.getAttribute('aria-selected');
  await userEvent.keyboard('가 나{ArrowLeft}{ArrowRight}{Home}{End} 다');
  expect(field).toHaveProperty('value', '가 나 다');
  expect(document.activeElement).toBe(field);
  expect(row.getAttribute('aria-selected')).toBe(selected);
});

it('gives each section its own box for the head and the line above it', async () => {
  setup();
  await screen.findByRole('option', {name: '첫 곡'});
  act(() =>
    applyService({
      id: SERVICE_ID,
      revision: 2,
      name: 'Invented service',
      readOnly: false,
      rows: [
        {kind: 'header', id: 'praise', title: '찬양'},
        {kind: 'song', id: SONG_ITEM, title: '첫 곡'},
      ],
      tiles: {},
      jumpKeys: {},
    }),
  );
  const section = (await screen.findByRole('option', {name: '찬양'})).closest(
    '[data-order-id="praise"]',
  );
  expect(section?.className).not.toBe('');
});
