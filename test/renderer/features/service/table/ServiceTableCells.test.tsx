import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import type {ItemRow} from '@core/presentation/model';
import {createServiceItemId, createSongId} from '@core/schema/ids';
import {fixtureMedia, itemMedia} from '@fixtures/core/mediaList';
import type {ServiceItem} from '@core/schema/service';
import {newSlidesItem} from '@core/services/slidesEdits';
import {createDefaultThemes} from '@core/themes/defaults';
import type {ItemEditRequest} from '@renderer/features/service/items/itemEditQueue';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {ServiceTableCells} from '@renderer/features/service/table/ServiceTableCells';

const ITEM_ID = createServiceItemId('00000000-0000-4000-8000-000000000101');
const SERVICE_ID = '00000000-0000-4000-8000-000000000010';
const MACRO_ID = '00000000-0000-4000-8000-000000000301';
const themes = createDefaultThemes();
const songTheme = themes.themes[0];
if (songTheme === undefined) throw new Error('Expected a song theme');
const macroDocument = settingsDocument('macros', {
  macros: [
    {id: MACRO_ID, name: '점검 1분', icon: 'bolt', color: 'teal', actions: []},
  ],
  collections: [],
});
const macros =
  macroDocument.name === 'macros' ? macroDocument.value.macros : [];

const SONG_ID = createSongId('00000000-0000-4000-8000-000000000201');
const media = itemMedia().value.items;
const songs = new Map([[SONG_ID, {background: fixtureMedia.warm}]]);

function rowOf(background?: {mediaId: string; title?: string}): ItemRow {
  return {
    kind: 'song',
    id: ITEM_ID,
    title: '첫 곡',
    ...(background === undefined
      ? {}
      : {background: {loop: false, ...background}}),
  };
}

function song(extra: object = {}): ServiceItem {
  return {slides: [], id: ITEM_ID, song: SONG_ID, ...extra};
}

function setup({
  item = song(),
  row = rowOf(),
  readOnly = false,
}: {
  readonly item?: ServiceItem;
  readonly row?: ItemRow;
  readonly readOnly?: boolean;
} = {}) {
  const submitItemEdit = vi.fn<(request: ItemEditRequest) => Promise<boolean>>(
    async () => true,
  );
  render(
    <ServiceTableCells
      row={row}
      item={item}
      detail="4"
      themes={themes}
      macros={macros}
      media={media}
      songs={songs}
      items={{submitItemEdit}}
      serviceId={SERVICE_ID}
      readOnly={readOnly}
    />,
  );
  return {submitItemEdit};
}

afterEach(cleanup);

it.each(['blank', 'ad'] as const)(
  'shows %s slide count and editable theme, background, start and memo cells',
  form => {
    setup({
      item: newSlidesItem(form, ITEM_ID),
      row: {kind: 'slides', form, id: ITEM_ID, title: '슬라이드'},
    });
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.queryByRole('button', {name: /^구성,/})).toBeNull();
    expect(screen.getByRole('button', {name: '테마, 슬라이드'})).toBeTruthy();
    expect(screen.getByRole('button', {name: '배경, 슬라이드'})).toBeTruthy();
    expect(
      screen.getByRole('button', {name: '시작할 때, 슬라이드'}),
    ).toBeTruthy();
  },
);

it('shows the 슬라이드 count, 테마, 시작할 때, and 메모 of the item', () => {
  setup({
    item: song({macro: MACRO_ID, memo: '간주 길게'}),
  });

  expect(screen.getByText('4')).toBeDefined();
  expect(screen.getByRole('button', {name: /^테마, /}).textContent).toBe(
    songTheme.name,
  );
  expect(screen.getByRole('button', {name: /^시작할 때, /}).textContent).toBe(
    '점검 1분',
  );
  expect(screen.getByRole('button', {name: /^메모, /}).textContent).toBe(
    '간주 길게',
  );
});

it('leaves the start cell empty when the item sets none', () => {
  setup();

  expect(screen.getByRole('button', {name: /^시작할 때, /}).textContent).toBe(
    '',
  );
});

it('opens the menu of an empty 시작할 때 cell, which names 없음 as the checked choice', async () => {
  setup();

  await userEvent.click(screen.getByRole('button', {name: /^시작할 때, /}));

  expect(
    screen.getByRole('menuitemradio', {name: '없음', checked: true}),
  ).toBeDefined();
});

it('writes the chosen 테마 and 매크로 for this row only', async () => {
  const {submitItemEdit} = setup();
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', {name: /^시작할 때, /}));
  await user.click(screen.getByRole('menuitemradio', {name: '점검 1분'}));

  expect(submitItemEdit).toHaveBeenCalledOnce();
  const [request] = submitItemEdit.mock.calls[0] ?? [];
  expect(request).toMatchObject({
    target: {serviceId: SERVICE_ID, itemId: ITEM_ID},
  });
  expect(request?.change(song())).toMatchObject({macro: MACRO_ID});
});

it('keeps both lists closed for a read-only service', async () => {
  const {submitItemEdit} = setup({readOnly: true});

  await userEvent.click(screen.getByRole('button', {name: /^테마, /}));

  expect(screen.queryByRole('menu')).toBeNull();
  expect(submitItemEdit).not.toHaveBeenCalled();
});

it('shows a still and the name of the video, image, or song default that plays, and 없음 for none', () => {
  const view = (row: ItemRow, item: ServiceItem = song()) => {
    cleanup();
    setup({row, item});
    return screen.getByRole('button', {name: /^배경, /});
  };
  const video = view(
    rowOf({mediaId: fixtureMedia.dawn}),
    song({background: fixtureMedia.dawn}),
  );
  expect(video.textContent).toBe('새벽 하늘');
  expect(video.querySelector('img')?.getAttribute('src')).toContain(
    fixtureMedia.dawn,
  );
  expect(video.querySelector('img')?.getAttribute('src')).not.toContain(
    '/media/',
  );
  const image = view(
    rowOf({mediaId: fixtureMedia.warm}),
    song({background: fixtureMedia.warm}),
  );
  expect(image.textContent).toBe('따뜻한 빛');
  const inherited = view(rowOf({mediaId: fixtureMedia.warm}));
  expect(inherited.textContent).toBe('따뜻한 빛');
  expect(inherited.className).toContain('dim');
  expect(view(rowOf()).textContent).toBe('없음');
  expect(
    screen.getByRole('button', {name: /^배경, /}).querySelector('img'),
  ).toBeNull();
});

it('writes the chosen 배경 for this row only', async () => {
  const {submitItemEdit} = setup();
  const user = userEvent.setup();

  expect(screen.getByRole('button', {name: /^배경, /}).textContent).toBe(
    '없음',
  );
  await user.click(screen.getByRole('button', {name: /^배경, /}));
  expect(screen.getByRole('listbox', {name: '배경 선택'})).toBeTruthy();
  expect(screen.getByRole('option', {name: '곡 기본값'})).toBeTruthy();
  await user.click(await screen.findByRole('option', {name: /새벽 하늘/}));
  expect(submitItemEdit.mock.calls[0]?.[0].change(song())).toMatchObject({
    background: fixtureMedia.dawn,
  });
  expect(submitItemEdit.mock.calls[0]?.[0].target).toEqual({
    serviceId: SERVICE_ID,
    itemId: ITEM_ID,
  });
});

it('edits the memo as text in the cell, saves on Enter or leaving, and cancels on Esc', async () => {
  const {submitItemEdit} = setup({item: song({memo: '간주 길게'})});
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', {name: /^메모, /}));
  const field = screen.getByRole('textbox', {name: /^메모, /});
  await user.clear(field);
  await user.type(field, '바로 시작{Enter}');
  expect(submitItemEdit).toHaveBeenCalledOnce();
  expect(submitItemEdit.mock.calls[0]?.[0].change(song())).toMatchObject({
    memo: '바로 시작',
  });
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: /^메모, /}),
    ),
  );

  await user.click(screen.getByRole('button', {name: /^메모, /}));
  await user.type(
    screen.getByRole('textbox', {name: /^메모, /}),
    '버릴 글{Escape}',
  );
  expect(submitItemEdit).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', {name: /^메모, /}).textContent).toBe(
    '간주 길게',
  );

  await user.click(screen.getByRole('button', {name: /^메모, /}));
  fireEvent.change(screen.getByRole('textbox', {name: /^메모, /}), {
    target: {value: ''},
  });
  fireEvent.blur(screen.getByRole('textbox', {name: /^메모, /}));
  expect(submitItemEdit).toHaveBeenCalledTimes(2);
  expect(
    submitItemEdit.mock.calls[1]?.[0].change(song({memo: 'x'})),
  ).not.toHaveProperty('memo');
});

it('keeps the memo and 배경 closed for a read-only service', async () => {
  const {submitItemEdit} = setup({readOnly: true});
  await userEvent.click(screen.getByRole('button', {name: /^메모, /}));
  await userEvent.click(screen.getByRole('button', {name: /^배경, /}));
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('menu')).toBeNull();
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(submitItemEdit).not.toHaveBeenCalled();
});

it('saves a memo at most once when a blur follows Enter, and not at all after Esc', async () => {
  const {submitItemEdit} = setup({item: song({memo: '간주 길게'})});
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', {name: /^메모, /}));
  const first = screen.getByRole('textbox', {name: /^메모, /});
  fireEvent.change(first, {target: {value: '바로 시작'}});
  fireEvent.keyDown(first, {key: 'Enter'});
  fireEvent.blur(first);
  expect(submitItemEdit).toHaveBeenCalledOnce();

  await user.click(await screen.findByRole('button', {name: /^메모, /}));
  const second = screen.getByRole('textbox', {name: /^메모, /});
  fireEvent.change(second, {target: {value: '버릴 글'}});
  fireEvent.keyDown(second, {key: 'Escape'});
  fireEvent.blur(second);
  expect(submitItemEdit).toHaveBeenCalledOnce();
});

it('names every cell button with its row, so a screen reader hears which row it is', () => {
  setup({item: song({macro: MACRO_ID, memo: '간주 길게'})});
  for (const name of ['테마', '배경', '시작할 때', '메모']) {
    expect(screen.getByRole('button', {name: `${name}, 첫 곡`})).toBeDefined();
  }
});

it('keeps the typed memo in the field until the save works', async () => {
  const {submitItemEdit} = setup({item: song({memo: '간주 길게'})});
  submitItemEdit.mockResolvedValueOnce(false);
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', {name: /^메모, /}));
  const field = screen.getByRole('textbox', {name: /^메모, /});
  await user.clear(field);
  await user.type(field, '바로 시작{Enter}');
  await waitFor(() => expect(submitItemEdit).toHaveBeenCalledOnce());
  expect(screen.getByRole('textbox', {name: /^메모, /})).toHaveProperty(
    'value',
    '바로 시작',
  );

  await user.keyboard('{Enter}');
  await waitFor(() => expect(submitItemEdit).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByRole('textbox', {name: /^메모, /})).toBeNull(),
  );
});

it('holds the field still while a save waits, so newer text is never lost', async () => {
  const {submitItemEdit} = setup({item: song({memo: '간주 길게'})});
  let finish: (saved: boolean) => void = () => undefined;
  submitItemEdit.mockReturnValueOnce(
    new Promise<boolean>(resolve => {
      finish = resolve;
    }),
  );
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', {name: /^메모, /}));
  const field = screen.getByRole('textbox', {name: /^메모, /});
  await user.clear(field);
  await user.type(field, '바로 시작{Enter}');
  expect(field).toHaveProperty('readOnly', true);
  await user.type(field, '덧붙임');
  expect(field).toHaveProperty('value', '바로 시작');

  await act(async () => {
    finish(true);
  });
  await waitFor(() =>
    expect(screen.queryByRole('textbox', {name: /^메모, /})).toBeNull(),
  );
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: /^메모, /}),
  );
});

it('ignores Escape while a save waits, so the field cannot be reopened under an older save', async () => {
  const {submitItemEdit} = setup({item: song({memo: '간주 길게'})});
  let finish: (saved: boolean) => void = () => undefined;
  submitItemEdit.mockReturnValueOnce(
    new Promise<boolean>(resolve => {
      finish = resolve;
    }),
  );
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', {name: /^메모, /}));
  const field = screen.getByRole('textbox', {name: /^메모, /});
  await user.clear(field);
  await user.type(field, '바로 시작{Enter}{Escape}');
  expect(screen.getByRole('textbox', {name: /^메모, /})).toHaveProperty(
    'value',
    '바로 시작',
  );
  expect(screen.queryByRole('button', {name: /^메모, /})).toBeNull();

  await act(async () => {
    finish(true);
  });
  await waitFor(() =>
    expect(screen.queryByRole('textbox', {name: /^메모, /})).toBeNull(),
  );
  expect(submitItemEdit).toHaveBeenCalledOnce();
});

it('leaves the 슬라이드 cell of a media item empty, since the length shows on its tile', () => {
  const {container} = render(
    <ServiceTableCells
      row={{kind: 'media', id: ITEM_ID, title: '새벽빛 반복'}}
      item={{id: ITEM_ID, media: fixtureMedia.dawn}}
      detail="0:12"
      themes={themes}
      macros={macros}
      media={media}
      songs={songs}
      items={{submitItemEdit: vi.fn()}}
      serviceId={SERVICE_ID}
      readOnly={false}
    />,
  );
  expect(container.textContent).not.toContain('0:12');
});
