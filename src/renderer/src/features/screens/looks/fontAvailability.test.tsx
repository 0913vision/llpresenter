import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {FontCatalog} from '@core/schema/fontCatalog';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {fontFamilyFixture} from '@core/testing/fontCatalog';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/looks';
const DEFAULT_LYRIC_STYLE = {
  ...DEFAULT_MESSAGE_STYLE,
  referencePosition: 'bottomRight' as const,
};
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {
  LOOK_ID,
  MAIN_ID,
  STAGE_ID,
  looksDocument,
  screensDocument,
  settingsDocument,
} from '@core/testing/screenDocuments';
import {
  installedFamily,
  lookFontWarnings,
  missingFontReason,
  weightChoices,
} from './fontAvailability';
import {LyricStyleProperties} from './LyricStyleProperties';
import {useFontCatalog} from './useFontCatalog';

const family = fontFamilyFixture();
const ready = {status: 'ready', families: [family]} as const;
const STYLE_ID = '00000000-0000-4000-8000-000000000301';

afterEach(() => {
  cleanup();
  delete window.llp;
  resetTooltips();
  vi.useRealTimers();
});

function documentWithFont(font: string) {
  const base = looksDocument();
  if (base.name !== 'looks') throw new Error('Expected Looks');
  const document = settingsDocument('looks', {
    ...base.value,
    lyricStyles: [{...DEFAULT_LYRIC_STYLE, id: STYLE_ID, name: '기본', font}],
    looks: [
      {
        id: LOOK_ID,
        name: '평상시',
        screens: {
          [MAIN_ID]: {layers: {slide: true}, lyricStyle: STYLE_ID},
          [STAGE_ID]: {layers: {}, lyricStyle: STYLE_ID},
        },
      },
    ],
  });
  if (document.name !== 'looks') throw new Error('Expected Looks');
  return document.value;
}

it('recognizes localized aliases, waits for enumeration and keeps bundled variable fonts available', () => {
  expect(installedFamily('  FIXTURE SANS ', ready.families)).toBe(family);
  expect(installedFamily(family.label.normalize('NFD'), ready.families)).toBe(
    family,
  );
  expect(missingFontReason(family.label, ready)).toBeUndefined();
  expect(
    missingFontReason('Absent Fixture', {status: 'loading'}),
  ).toBeUndefined();
  expect(
    missingFontReason('Absent Fixture', {status: 'failed'}),
  ).toBeUndefined();
  expect(missingFontReason('Pretendard Variable', ready)).toBeUndefined();
  expect(missingFontReason('Absent Fixture', ready)).toBe(
    '글꼴이 없어 Pretendard로 표시 중: Absent Fixture',
  );
  expect(
    weightChoices('Pretendard Variable', 450, ready).find(
      item => item.value === '450',
    )?.disabled,
  ).toBe(false);
});

it('offers actual weights and preserves an unsupported saved weight without advertising it as supported', () => {
  const choices = weightChoices(family.label, 600, ready);
  expect(choices.map(item => item.value)).toEqual(['350', '400', '600', '700']);
  expect(
    choices.filter(item => !item.disabled).map(item => item.value),
  ).toEqual(['350', '400', '700']);
  expect(choices.find(item => item.value === '600')?.title).toBe(
    '이 글꼴에 없는 굵기',
  );
});

it.each([
  {weight: 44, disabled: true},
  {weight: 45, disabled: false},
  {weight: 920, disabled: false},
  {weight: 921, disabled: true},
])('recognizes bundled font weight $weight', ({weight, disabled}) => {
  for (const font of ['Pretendard', 'Pretendard Variable']) {
    for (const state of [
      ready,
      {status: 'loading'} as const,
      {status: 'failed'} as const,
    ]) {
      expect(
        weightChoices(font, weight, state).find(
          item => item.value === String(weight),
        )?.disabled,
      ).toBe(disabled);
    }
  }
  expect(
    weightChoices('Absent Fixture', weight, ready).find(
      item => item.value === String(weight),
    )?.disabled,
  ).toBe(disabled);
});

it('does not offer speculative weights before the installed family is known', async () => {
  let resolve: (fonts: FontCatalog) => void = () => undefined;
  window.llp = fakeLlpApi({
    fonts: {
      get: () =>
        new Promise(finish => {
          resolve = finish;
        }),
    },
  });
  const style = documentWithFont(family.label).lyricStyles[0];
  if (style === undefined) throw new Error('Missing style');
  const change = vi.fn();
  render(
    <LyricStyleProperties
      changeEffects={vi.fn()}
      style={style}
      reason={undefined}
      change={change}
    />,
  );
  const control = screen.getByLabelText('굵기');
  expect(control.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(control);
  expect(screen.queryByRole('menu')).toBeNull();
  await act(async () => {
    resolve([family]);
  });
  expect(control.getAttribute('aria-disabled')).toBeNull();
  expect(change).not.toHaveBeenCalled();
  expect(weightChoices(family.family, 700, {status: 'failed'})).toHaveLength(1);
});

it('marks only referenced audience fonts and removes the warning when the restored font is available', () => {
  const looks = documentWithFont('Absent Fixture');
  const screens = screensDocument();
  if (screens.name !== 'screens') throw new Error('Expected Screens');
  expect(
    lookFontWarnings(looks, screens.value.screens, ready).get(LOOK_ID),
  ).toBe('글꼴이 없어 Pretendard로 표시 중: Absent Fixture');
  expect(
    lookFontWarnings(
      looks,
      screens.value.screens.filter(screen => screen.kind === 'stage'),
      ready,
    ).size,
  ).toBe(0);
  expect(
    lookFontWarnings(looks, screens.value.screens, {status: 'loading'}).size,
  ).toBe(0);
  expect(
    lookFontWarnings(
      documentWithFont(family.label),
      screens.value.screens,
      ready,
    ).size,
  ).toBe(0);
});

it('loads once, ignores a late result after unmount and reports a failed read', async () => {
  let resolve: (fonts: FontCatalog) => void = () => undefined;
  const get = vi.fn(
    () =>
      new Promise<FontCatalog>(finish => {
        resolve = finish;
      }),
  );
  const log = vi.fn();
  window.llp = fakeLlpApi({fonts: {get}, log: {write: log}});
  const view = renderHook(useFontCatalog);
  expect(view.result.current.status).toBe('loading');
  view.rerender();
  expect(get).toHaveBeenCalledOnce();
  view.unmount();
  await act(async () => {
    resolve([family]);
  });
  expect(view.result.current.status).toBe('loading');
  get.mockRejectedValueOnce(new Error('Enumeration failed'));
  const failed = renderHook(useFontCatalog);
  await waitFor(() => expect(failed.result.current.status).toBe('failed'));
  expect(log).toHaveBeenCalledOnce();
});

it('sends a weight-only edit from the installed list and keeps read-only properties inert', async () => {
  window.llp = fakeLlpApi({fonts: {get: async () => [family]}});
  const style = documentWithFont(family.label).lyricStyles[0];
  if (style === undefined) throw new Error('Missing style');
  const change = vi.fn();
  const view = render(
    <LyricStyleProperties
      changeEffects={vi.fn()}
      style={style}
      reason={undefined}
      change={change}
    />,
  );
  await act(async () => undefined);
  fireEvent.click(screen.getByLabelText('굵기'));
  expect(screen.queryByRole('menuitemradio', {name: '100'})).toBeNull();
  fireEvent.click(screen.getByRole('menuitemradio', {name: '350'}));
  expect(change).toHaveBeenCalledExactlyOnceWith({weight: 350});
  view.rerender(
    <LyricStyleProperties
      changeEffects={vi.fn()}
      style={style}
      reason="읽기 전용"
      change={change}
    />,
  );
  fireEvent.click(screen.getByLabelText('굵기'));
  fireEvent.click(screen.getByLabelText('글꼴'));
  expect(screen.queryByRole('menu')).toBeNull();
  expect(change).toHaveBeenCalledOnce();
});

it('shows the missing-font reason and saves only an explicit replacement', async () => {
  window.llp = fakeLlpApi({fonts: {get: async () => [family]}});
  const style = documentWithFont('Absent Fixture').lyricStyles[0];
  if (style === undefined) throw new Error('Missing style');
  const change = vi.fn();
  render(
    <LyricStyleProperties
      changeEffects={vi.fn()}
      style={style}
      reason={undefined}
      change={change}
    />,
  );
  await act(async () => undefined);
  expect(change).not.toHaveBeenCalled();
  expect(
    (await hoverForTooltip(screen.getByLabelText('글꼴')))?.textContent,
  ).toContain('글꼴이 없어 Pretendard로 표시 중: Absent Fixture');
  resetTooltips();
  vi.useRealTimers();
  fireEvent.click(screen.getByLabelText('글꼴'));
  fireEvent.click(screen.getByRole('option', {name: 'Pretendard'}));
  expect(change).toHaveBeenCalledExactlyOnceWith({font: 'Pretendard'});
});
