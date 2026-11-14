import {sundayTemplate} from '@core/services/sundayTemplate';
import {newSlidesItem} from '@core/services/slidesEdits';
import {createDefaultThemes} from '@core/themes/defaults';
import {itemThemeCell} from '@core/themes/itemThemeCell';
import type {ServiceItem} from '@core/schema/service';

import type {SundaySection} from '@core/themes/sundaySections';
import type {LiturgyKind, LiturgyTranslation} from '@core/services/liturgy';
import {isItemOfKind} from '@core/schema/service';
import {describe, expect, it, vi} from 'vitest';
import {
  createPaletteItem,
  isPaletteKey,
  PALETTE_SECTIONS,
  ORDER_ELEMENTS,
} from '@renderer/features/service/items/paletteItems';
import {newLiturgyItem} from '@core/services/liturgy';
import {newSectionItem} from '@core/services/sectionCards';
import {createServiceItemId} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
vi.mock('@renderer/features/service/items/quickAddSection', () => ({
  prepareSection: vi.fn(async (section: SundaySection) =>
    newSectionItem(createServiceItemId(crypto.randomUUID()), section),
  ),
}));
vi.mock('@renderer/features/service/items/quickAddLiturgy', () => ({
  prepareLiturgy: vi.fn(
    async (kind: LiturgyKind, translation: LiturgyTranslation) =>
      newLiturgyItem(createServiceItemId(crypto.randomUUID()), {
        kind,
        translation,
      }),
  ),
}));
describe('palette items', () => {
  it('creates one empty slide referencing the current standby theme', async () => {
    expect(ORDER_ELEMENTS.at(-1)).toMatchObject({
      id: 'waiting-screen',
      label: '대기 화면',
    });
    const themes = createDefaultThemes();
    const base = mockLlpApi();
    window.llp = mockLlpApi({
      settings: {
        get: request =>
          request.name === 'themes'
            ? Promise.resolve(settingsDocument('themes', themes))
            : base.settings.get(request),
      },
    });
    try {
      const item = await createPaletteItem('waiting-screen');
      expect(item).toMatchObject({
        theme: themes.standby.id,
        slides: {form: 'blank', name: '대기 화면', slides: [{text: ''}]},
      });
      expect(isPaletteKey('waiting-screen')).toBe(true);
    } finally {
      delete window.llp;
    }
  });
  it('orders cards without the duplicate creed and advertisement', () => {
    const names = PALETTE_SECTIONS.map(section => section.name);
    expect(names.slice(0, 4)).toEqual([
      '묵상기도',
      '회개와간구의기도',
      '찬양',
      '합심기도',
    ]);
    expect(names).not.toContain('사도신경');
    expect(names).not.toContain('광고');
    expect(isPaletteKey('card:묵상기도')).toBe(true);
    expect(isPaletteKey('unknown')).toBe(false);
  });
  it('creates both card-bearing items and the requested prayer translation', async () => {
    const creed = await createPaletteItem('creed', 'old');
    const ad = await createPaletteItem('ad');
    const prayer = await createPaletteItem('prayer', 'old');
    expect(creed).toMatchObject({sectionCard: {name: '사도신경'}});
    expect(ad).toMatchObject({sectionCard: {name: '광고'}});
    expect(prayer).toMatchObject({slides: {name: '주기도문'}});
    if (!prayer || !isItemOfKind(prayer, 'slides')) {
      throw new Error('Expected prayer slides');
    }
    const first = prayer.slides.slides[0];
    expect(first && 'text' in first && first.text.length).toBeGreaterThan(20);
    expect(await createPaletteItem('header')).toMatchObject({
      header: '새 구역',
    });
    expect(await createPaletteItem('standby')).toMatchObject({
      slides: {name: '예배 준비'},
    });
    expect(await createPaletteItem('blank')).toMatchObject({
      slides: {form: 'blank'},
    });
  });
});

function withoutIds(item: ServiceItem | null): unknown {
  const value: unknown = JSON.parse(
    JSON.stringify(item, (key: string, value: unknown) =>
      key === 'id' ? '<id>' : value,
    ),
  );
  return value;
}

it.each([
  ['standby', '예배 준비'],
  ['creed', '사도신경'],
  ['ad', '광고'],
  ...PALETTE_SECTIONS.filter(section =>
    [
      '묵상기도',
      '회개와간구의기도',
      '찬양',
      '합심기도',
      '봉헌',
      '봉헌기도',
      '축도',
    ].includes(section.name),
  ).map(section => [`card:${section.name}`, section.name]),
])(
  'builds %s exactly as the Sunday template does, except ids',
  async (key, name) => {
    const template = sundayTemplate().order.find(
      item => isItemOfKind(item, 'slides') && item.slides.name === name,
    );
    expect(template).toBeDefined();
    expect(withoutIds(await createPaletteItem(key))).toEqual(
      withoutIds(template ?? null),
    );
  },
);

it('uses the shared section, liturgy and blank factories for every remaining element', async () => {
  for (const section of PALETTE_SECTIONS) {
    const actual = await createPaletteItem(`card:${section.name}`);
    expect(withoutIds(actual)).toEqual(
      withoutIds(
        newSectionItem(createServiceItemId(crypto.randomUUID()), section),
      ),
    );
    expect(actual?.theme).toBe(section.theme);
    expect(
      itemThemeCell(
        actual ?? {
          id: createServiceItemId(crypto.randomUUID()),
          header: 'unused',
        },
        createDefaultThemes(),
      )?.name,
    ).toBe(`구역 이름 ${section.color}`);
  }
  for (const kind of ['creed', 'prayer'] as const) {
    for (const translation of ['new', 'old'] as const) {
      const actual = await createPaletteItem(kind, translation);
      const expected = newLiturgyItem(
        createServiceItemId(crypto.randomUUID()),
        {kind, translation},
      );
      if (kind === 'prayer') {
        expect(withoutIds(actual)).toEqual(withoutIds(expected));
      } else if (actual && isItemOfKind(actual, 'slides')) {
        const {sectionCard, ...content} = actual;
        expect(sectionCard?.name).toBe('사도신경');
        expect(withoutIds(content)).toEqual(withoutIds(expected));
      } else throw new Error('Missing creed');
    }
  }
  expect(withoutIds(await createPaletteItem('blank'))).toEqual(
    withoutIds(
      newSlidesItem('blank', createServiceItemId(crypto.randomUUID())),
    ),
  );
  expect(withoutIds(await createPaletteItem('header'))).toEqual(
    withoutIds({
      id: createServiceItemId(crypto.randomUUID()),
      header: '새 구역',
    }),
  );
});
