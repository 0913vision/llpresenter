import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {FontCatalog} from '@core/schema/fontCatalog';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {fontFamilyFixture} from '@core/testing/fontCatalog';
import {
  installedFamily,
  missingFontReason,
  weightChoices,
} from './fontAvailability';
import {useFontCatalog} from './useFontCatalog';

const family = fontFamilyFixture();
const ready = {status: 'ready', families: [family]} as const;

afterEach(() => {
  cleanup();
  delete window.llp;
  vi.useRealTimers();
});

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

it('loads once, ignores a late result after unmount and reports a failed read', async () => {
  let resolve: (fonts: FontCatalog) => void = () => undefined;
  const get = vi.fn(
    () =>
      new Promise<FontCatalog>(finish => {
        resolve = finish;
      }),
  );
  const log = vi.fn();
  window.llp = mockLlpApi({fonts: {get}, log: {write: log}});
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
