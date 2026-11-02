import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import type {ItemRow} from '@core/presentation/model';
import {createServiceItemId, createSongId} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
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

const row: ItemRow = {kind: 'song', id: ITEM_ID, title: '첫 곡'};

function song(extra: object = {}): ServiceItem {
  return {
    id: ITEM_ID,
    song: createSongId('00000000-0000-4000-8000-000000000201'),
    ...extra,
  };
}

function setup({
  item = song(),
  readOnly = false,
}: {readonly item?: ServiceItem; readonly readOnly?: boolean} = {}) {
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
      items={{submitItemEdit}}
      serviceId={SERVICE_ID}
      readOnly={readOnly}
    />,
  );
  return {submitItemEdit};
}

afterEach(cleanup);

it('shows the 구성, 슬라이드 count, 테마, 시작할 때, and 메모 of the item', () => {
  setup({
    item: song({arrangement: '짧게', macro: MACRO_ID, memo: '간주 길게'}),
  });

  expect(screen.getByText('짧게')).toBeDefined();
  expect(screen.getByText('4')).toBeDefined();
  expect(screen.getByRole('button', {name: '테마'}).textContent).toBe(
    songTheme.name,
  );
  expect(screen.getByRole('button', {name: '시작할 때'}).textContent).toBe(
    '점검 1분',
  );
  expect(screen.getByText('간주 길게')).toBeDefined();
});

it('shows 기본 for the 구성 and 없음 for the start when the item sets none', () => {
  setup();

  expect(screen.getByText('기본')).toBeDefined();
  expect(screen.getByRole('button', {name: '시작할 때'}).textContent).toBe(
    '없음',
  );
});

it('writes the chosen 테마 and 매크로 for this row only', async () => {
  const {submitItemEdit} = setup();
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', {name: '시작할 때'}));
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

  await userEvent.click(screen.getByRole('button', {name: '테마'}));

  expect(screen.queryByRole('menu')).toBeNull();
  expect(submitItemEdit).not.toHaveBeenCalled();
});
