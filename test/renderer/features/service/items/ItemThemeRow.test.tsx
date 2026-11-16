import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {createDefaultThemes} from '@core/themes/defaults';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {slidesItem} from '@fixtures/core/slides';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';
import {createServiceItemId, createThemeId} from '@core/schema/ids';
import {themeRequest} from '@renderer/features/service/items/itemAppearanceCommands';
import {
  ItemThemeRow,
  useItemTheme,
} from '@renderer/features/service/details/ItemThemeRow';

afterEach(cleanup);

it('warns in slide item settings when the selected theme cannot display its content', async () => {
  const id = createScreenId('00000000-0000-4000-8000-000000000001');
  const screens = [
    {id, name: 'Audience', kind: 'audience', method: 'fullscreen'},
  ] as const;
  const file = createDefaultThemes(screens);
  const themes = {
    ...file,
    themes: file.themes.map(theme => ({
      ...theme,
      screens: {[id]: {mode: {kind: 'own'}, elements: []}},
    })),
  } as const;
  const base = mockLlpApi();
  const api = mockLlpApi({
    settings: {
      get: request =>
        request.name === 'themes'
          ? Promise.resolve(settingsDocument('themes', themes))
          : request.name === 'screens'
            ? Promise.resolve(settingsDocument('screens', {screens}))
            : base.settings.get(request),
    },
  });
  const editor = new SongEditorStore(api, vi.fn());
  const items = new ServiceItemStore(api, editor, vi.fn());
  const view = render(
    <ItemThemeRow
      api={api.settings}
      items={items}
      item={slidesItem()}
      reason={undefined}
    />,
  );
  expect(
    await screen.findByRole('img', {name: '테마에 필요한 요소 없음'}),
  ).toBeTruthy();
  view.unmount();
  items.dispose();
  await editor.dispose();
});

it('resolves inherited liturgy themes the same way as output', async () => {
  const base = mockLlpApi();
  const api = mockLlpApi({
    settings: {
      get: request =>
        request.name === 'themes'
          ? Promise.resolve(settingsDocument('themes', createDefaultThemes([])))
          : request.name === 'screens'
            ? Promise.resolve(settingsDocument('screens', {screens: []}))
            : base.settings.get(request),
    },
  });
  const item = {
    id: createServiceItemId('00000000-0000-4000-8000-000000000001'),
    liturgy: {kind: 'prayer', translation: 'new'},
  } as const;
  const {result} = renderHook(() => useItemTheme(api.settings, item));
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.theme?.id).toBe(CREED_PRAYER_THEME_ID);
});

it('saves a sermon theme override through the table command', () => {
  const item = {
    id: createServiceItemId('00000000-0000-4000-8000-000000000001'),
    sermon: {
      title: 'Title',
      passage: {
        translation: 'sample',
        ref: 'John 3:16',
        split: 'verse',
        reference: 'every',
        verseNumbers: true,
        translationName: false,
      },
    },
  } as const;
  const theme = createThemeId('00000000-0000-4000-8000-000000000111');
  expect(themeRequest(null, theme).change(item)).toMatchObject({theme});
});
