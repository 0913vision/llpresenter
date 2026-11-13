import {expect, it} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {createDefaultThemes} from '@core/themes/defaults';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {positionFollowingBoxes} from '@renderer/rendering/themeFollow';

it('keeps the same gaps and center as the title wraps', () => {
  const theme = createDefaultThemes().themes.find(t =>
    t.id.endsWith('000000000106'),
  );
  const layout = theme?.screens[createScreenId(STARTER_SCREEN_IDS.main)];
  if (!layout) throw Error('Missing layout');
  const measure = (lines: number, round = false) => {
    const views = layout.elements.map(element => {
      let y = element.frame.y;
      return {
        element,
        setY(value: number) {
          y = value;
        },
        textBounds(ink = false) {
          const measuredY = round ? Math.round(y * 64) / 64 : y;
          if (element.kind === 'itemName') {
            return {
              top: measuredY + 23.390625 + (ink ? 8 : 0),
              bottom: measuredY + 126.578125,
            };
          }
          if (element.kind === 'currentText') {
            return {
              top: measuredY,
              bottom: measuredY + lines * 166.59375 - (ink ? 24 : 0),
            };
          }
          return undefined;
        },
        get y() {
          return y;
        },
      };
    });
    positionFollowingBoxes(views);
    const top = views.find(
      v => v.element.kind === 'box' && v.element.follow?.side === 'above',
    );
    const bottom = views.find(
      v => v.element.kind === 'box' && v.element.follow?.side === 'below',
    );
    const reference = views
      .find(v => v.element.kind === 'itemName')
      ?.textBounds(true);
    const title = views
      .find(v => v.element.kind === 'currentText')
      ?.textBounds(true);
    if (!top || !bottom || !reference || !title) throw Error('Missing views');
    const referenceLine = views
      .find(v => v.element.kind === 'itemName')
      ?.textBounds();
    const titleLine = views
      .find(v => v.element.kind === 'currentText')
      ?.textBounds();
    if (!referenceLine || !titleLine) throw Error('Missing line boxes');
    expect(
      titleLine.top +
        166.59375 / 2 -
        (referenceLine.top + referenceLine.bottom) / 2,
    ).toBeCloseTo(162, 1);
    expect(
      Math.abs(reference.top - top.y - 4 - (bottom.y - title.bottom)),
    ).toBeLessThan(2);
    expect((top.y + bottom.y + 4) / 2).toBeCloseTo(540);
    return {top: top.y, bottom: bottom.y};
  };
  expect(measure(1).top).toBeCloseTo(289, 1);
  expect(measure(1).bottom).toBeCloseTo(787, 1);
  const two = measure(2);
  expect(two.top).toBe(206);
  expect(two.bottom).toBe(870);
  for (const lines of [1, 2]) {
    const rounded = measure(lines, true);
    expect(rounded.top + rounded.bottom + 4).toBeCloseTo(1080, 10);
  }
});
