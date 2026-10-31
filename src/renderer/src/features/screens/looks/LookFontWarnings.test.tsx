import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {FontCatalog} from '@core/schema/fontCatalog';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {fontFamilyFixture} from '@core/testing/fontCatalog';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/looks';
const DEFAULT_LYRIC_STYLE = {
  ...DEFAULT_MESSAGE_STYLE,
  referencePosition: 'bottomRight' as const,
};
import {
  LOOK_ID,
  MAIN_ID,
  looksDocument,
  screensDocument,
  settingsDocument,
} from '@core/testing/screenDocuments';
import {LookPanel} from './LookPanel';

afterEach(() => {
  cleanup();
  delete window.llp;
});

it('updates a Look row warning after enumeration and a settings push without editing its saved font', async () => {
  const styleId = '00000000-0000-4000-8000-000000000301';
  const initial = looksDocument();
  if (initial.name !== 'looks') throw new Error('Expected Looks');
  const value = {
    ...initial.value,
    lyricStyles: [
      {
        ...DEFAULT_LYRIC_STYLE,
        id: styleId,
        name: '기본',
        font: 'Absent Fixture',
      },
    ],
    looks: [
      {
        id: LOOK_ID,
        name: '평상시',
        screens: {[MAIN_ID]: {layers: {slide: true}, lyricStyle: styleId}},
      },
    ],
  };
  let resolve: (fonts: FontCatalog) => void = () => undefined;
  const fonts = new Promise<FontCatalog>(finish => {
    resolve = finish;
  });
  const edit = vi.fn();
  const listeners = new Set<(document: SettingsDocument) => void>();
  window.llp = fakeLlpApi({
    fonts: {get: () => fonts},
    settings: {
      get: async request =>
        request.name === 'looks'
          ? settingsDocument('looks', value)
          : request.name === 'screens'
            ? screensDocument()
            : settingsDocument('macros', {collections: [], macros: []}),
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  const view = render(<LookPanel />);
  const row = await screen.findByRole('option', {name: '평상시'});
  expect(within(row).queryByRole('img')).toBeNull();
  await act(async () => {
    resolve([fontFamilyFixture()]);
  });
  expect(
    within(row).getByRole('img', {
      name: '글꼴이 없어 Pretendard로 표시 중: Absent Fixture',
    }),
  ).toBeDefined();
  const available = settingsDocument(
    'looks',
    {
      ...value,
      lyricStyles: value.lyricStyles.map(style => ({
        ...style,
        font: fontFamilyFixture().label,
      })),
    },
    2,
  );
  act(() => {
    for (const listener of listeners) listener(available);
  });
  await waitFor(() => expect(within(row).queryByRole('img')).toBeNull());
  expect(edit).not.toHaveBeenCalled();
  view.unmount();
  expect(listeners.size).toBe(0);
});
