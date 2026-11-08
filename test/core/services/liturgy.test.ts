import {describe, expect, it} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {LITURGY, liturgySlides, newLiturgyItem} from '@core/services/liturgy';
import {LITURGY_DRAFTS} from '@core/services/liturgyDrafts';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';
import {layoutText} from '@core/bible/split/layout';
import {mockMeasure, mockSplitLayout} from '@fixtures/core/bibleSplit';

const id = createServiceItemId('50000000-0000-4000-8000-000000000371');

describe('built-in liturgy slides', () => {
  for (const kind of ['creed', 'prayer'] as const) {
    for (const translation of ['new', 'old'] as const) {
      it(`preserves every word of ${kind} ${translation} in editable manual slides`, () => {
        const layout = mockSplitLayout(100, 4);
        const item = newLiturgyItem(id, {kind, translation}, layout);
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
        expect(texts.join(' ').replace(/\s+/gu, ' ')).toBe(
          LITURGY[kind][translation],
        );
        expect(texts).toEqual(
          LITURGY_DRAFTS[kind][translation].map(lines => lines.join('\n')),
        );
        for (const text of texts) {
          const lines = text.split('\n');
          expect(lines.length).toBeGreaterThan(0);
          expect(lines.length).toBeLessThanOrEqual(4);
          for (const line of lines) {
            const measured = layoutText(line, layout);
            expect(measured.nLines).toBe(1);
            expect(
              measured.lineWidths.every(width => width <= layout.spec.width),
            ).toBe(true);
            expect(line).not.toBe('아멘.');
          }
        }
        expect(texts.at(-1)).toMatch(/\S+ 아멘\.$/u);
      });
    }
  }
  it('keeps short draft lines and page boundaries instead of filling available width', () => {
    expect(
      liturgySlides(
        [
          ['그는 성령으로 잉태되어', '동정녀 마리아에게서 나시고,'],
          ['십자가에 못 박혀 죽으시고,'],
        ],
        mockSplitLayout(100, 4),
      ),
    ).toEqual([
      '그는 성령으로 잉태되어\n동정녀 마리아에게서 나시고,',
      '십자가에 못 박혀 죽으시고,',
    ]);
  });
  it('splits only the overflowing church phrase and carries its continuation onto the next draft page', () => {
    const layout = mockSplitLayout(100, 4);
    const slides = liturgySlides(LITURGY_DRAFTS.creed.old, {
      ...layout,
      measure: (text, spec) =>
        mockMeasure(text, {
          ...spec,
          width:
            text === '거룩한 공회와 성도가 서로 교통하는 것과,'
              ? 18
              : spec.width,
        }),
    });
    expect(slides).toHaveLength(5);
    expect(slides.slice(0, 3)).toEqual(
      LITURGY_DRAFTS.creed.old.slice(0, 3).map(lines => lines.join('\n')),
    );
    expect(slides.slice(3)).toEqual([
      '저리로서 산 자와 죽은 자를\n심판하러 오시리라.\n성령을 믿사오며,\n거룩한 공회와',
      '성도가 서로 교통하는 것과,\n죄를 사하여 주시는 것과,\n몸이 다시 사는 것과,\n영원히 사는 것을 믿사옵나이다. 아멘.',
    ]);
  });
  it('refuses a line that would require breaking inside a phrase', () => {
    expect(() =>
      liturgySlides([['동정녀 마리아에게서 나시고,']], mockSplitLayout(10, 4)),
    ).toThrow('Liturgy draft line cannot fit without breaking a phrase');
  });
});
