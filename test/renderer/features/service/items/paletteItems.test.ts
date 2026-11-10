import type {SundaySection} from '@core/themes/sundaySections';
import type {LiturgyKind, LiturgyTranslation} from '@core/services/liturgy';
import {isItemOfKind} from '@core/schema/service';
import {describe, expect, it, vi} from 'vitest';
import {
  createPaletteItem,
  isPaletteKey,
  PALETTE_SECTIONS,
} from '@renderer/features/service/items/paletteItems';
import {newLiturgyItem} from '@core/services/liturgy';
import {newSectionItem} from '@core/services/sectionCards';
import {createServiceItemId} from '@core/schema/ids';
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
