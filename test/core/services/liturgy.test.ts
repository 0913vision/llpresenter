import {describe, expect, it} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {
  LITURGY,
  liturgyAsSlides,
  newLiturgyItem,
  withLiturgyTranslation,
} from '@core/services/liturgy';
import {LITURGY_SLIDES} from '@core/services/liturgySlides';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';

const id = createServiceItemId('50000000-0000-4000-8000-000000000371');

describe('built-in liturgy slides', () => {
  it('retains a saved paragraph label in its slide adapter', () => {
    const item = newLiturgyItem(id, {kind: 'creed', translation: 'new'});
    const labelled = {
      ...item,
      liturgy: {...item.liturgy, labels: [{index: 1, label: 'Verse'}]},
    };
    const slides = liturgyAsSlides(labelled).slides.slides;
    expect(slides[1]?.label).toBe('Verse');
    expect(slides[0]?.label).toBeUndefined();
  });
  for (const kind of ['creed', 'prayer'] as const) {
    for (const translation of ['new', 'old'] as const) {
      it(`stores ${kind} ${translation} as a dedicated item with fixed paragraphs`, () => {
        const item = newLiturgyItem(id, {kind, translation});
        expect(item).toMatchObject({
          id,
          theme: CREED_PRAYER_THEME_ID,
          liturgy: {kind, translation},
        });
        expect(item).not.toHaveProperty('slides');
        const texts = LITURGY_SLIDES[kind][translation];
        expect(item.liturgy.transitions).toEqual(
          texts.map((_, index) => ({
            index,
            transition: {kind: 'wipe', dir: 'left', sec: 0.7},
          })),
        );
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
  it('stores a chosen transition separately for every new paragraph', () => {
    const transition = {kind: 'push', dir: 'right', sec: 1.25} as const;
    const item = newLiturgyItem(id, {
      kind: 'prayer',
      translation: 'new',
      transition,
    });
    expect(item.liturgy.transitions).toHaveLength(
      LITURGY_SLIDES.prayer.new.length,
    );
    expect(
      item.liturgy.transitions?.every(entry => entry.transition === transition),
    ).toBe(true);
    expect(
      liturgyAsSlides(item).slides.slides.every(
        slide => slide.transition === transition,
      ),
    ).toBe(true);
  });
  it('leaves existing liturgy without transitions untouched', () => {
    const old = {id, liturgy: {kind: 'prayer', translation: 'new'}} as const;
    expect(
      liturgyAsSlides(old).slides.slides.every(
        slide => slide.transition === undefined,
      ),
    ).toBe(true);
  });
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

it('retains the fifth prayer transition when switching back and forth', () => {
  const old = newLiturgyItem(id, {
    kind: 'prayer',
    translation: 'old',
    transition: {kind: 'dissolve', sec: 2},
  });
  const updated = withLiturgyTranslation(old, 'new');
  expect(liturgyAsSlides(updated).slides.slides[4]?.transition).toEqual({
    kind: 'dissolve',
    sec: 2,
  });
  expect(
    withLiturgyTranslation(withLiturgyTranslation(updated, 'old'), 'new')
      .liturgy.transitions,
  ).toEqual(updated.liturgy.transitions);
});
