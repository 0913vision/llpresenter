import {describe, expect, it} from 'vitest';
import {LITURGY_SLIDES} from '@core/services/liturgySlides';
import {creedPrayerLayout} from '@core/themes/creedPrayer';
import {layoutText} from '@core/bible/split/layout';
import {bibleMeasure} from '@renderer/rendering/bibleMeasure';

describe('liturgy paragraphs in the scripture text frame', () => {
  const element = creedPrayerLayout().elements.find(
    element => element.kind === 'currentText',
  );
  if (element?.kind !== 'currentText') throw new Error('Missing liturgy text');
  // NOTE(0913vision): NanumSquare Bold advances in ems for the bundled Korean texts.
  const advances = {hangul: 0.91, space: 0.25, punctuation: 0.294};
  const layout = bibleMeasure(element, {
    font: '',
    measureText: text => ({
      width: Array.from(text).reduce((sum, character) => {
        const advance =
          character === ' '
            ? advances.space
            : /[.,]/u.test(character)
              ? advances.punctuation
              : advances.hangul;
        return sum + advance * element.text.size;
      }, 0),
    }),
  });

  for (const kind of ['creed', 'prayer'] as const) {
    for (const translation of ['new', 'old'] as const) {
      it(`wraps ${kind} ${translation} into at most four lines without cutting words`, () => {
        expect(layout.spec).toMatchObject({
          size: 104,
          width: 1676,
          maxLines: 4,
        });
        for (const paragraph of LITURGY_SLIDES[kind][translation]) {
          const measured = layoutText(paragraph, layout);
          expect(measured.fits).toBe(true);
          expect(measured.nLines).toBeGreaterThan(0);
          expect(measured.nLines).toBeLessThanOrEqual(4);
          expect(measured.lines.join(' ')).toBe(paragraph);
          expect(measured.lines.at(-1)).not.toBe('아멘.');
        }
      });
    }
  }
});
