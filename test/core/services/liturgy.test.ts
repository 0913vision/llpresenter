import {describe, expect, it} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {LITURGY, newLiturgyItem} from '@core/services/liturgy';
import {LITURGY_SLIDES} from '@core/services/liturgySlides';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';

const id = createServiceItemId('50000000-0000-4000-8000-000000000371');

describe('built-in liturgy slides', () => {
  for (const kind of ['creed', 'prayer'] as const) {
    for (const translation of ['new', 'old'] as const) {
      it(`preserves every word of ${kind} ${translation} in editable manual paragraphs`, () => {
        const item = newLiturgyItem(id, {kind, translation});
        expect(item).toMatchObject({
          id,
          theme: CREED_PRAYER_THEME_ID,
          slides: {form: 'blank', name: LITURGY[kind].name},
        });
        expect(item.slides.advance).toBeUndefined();
        expect(item.slides.loop).toBeUndefined();
        const slides = item.slides.slides;
        expect(new Set(slides.map(slide => slide.id)).size).toBe(slides.length);
        const texts = slides.map(slide => {
          if (!('text' in slide)) throw new Error('Expected a text slide');
          return slide.text;
        });
        expect(texts.join(' ')).toBe(LITURGY[kind][translation]);
        expect(texts).toEqual(LITURGY_SLIDES[kind][translation]);
        for (const text of texts) {
          expect(text).not.toMatch(/[\r\n]/u);
          expect(text).toMatch(/[.,]$/u);
          expect(text).not.toBe('아멘.');
        }
        expect(texts.at(-1)).toMatch(/\S+ 아멘\.$/u);
      });
    }
  }
  it('keeps the five new creed passages with the two opening sentences together', () => {
    const slides = LITURGY_SLIDES.creed.new;
    expect(slides).toHaveLength(5);
    expect(slides[0]).toBe(
      '나는 전능하신 아버지 하나님, 천지의 창조주를 믿습니다. 나는 그의 유일하신 아들, 우리 주 예수 그리스도를 믿습니다.',
    );
    expect(slides[1]).toMatch(/^그는 성령으로 .*죽으시고,$/u);
    expect(slides[2]).toMatch(/^장사된 지 .*계시다가,$/u);
    expect(slides[3]).toMatch(/^거기로부터 .*오십니다\.$/u);
    expect(slides[4]).toMatch(/^나는 성령을 믿으며, .*아멘\.$/u);
  });
});
