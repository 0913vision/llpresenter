import {expect, it} from 'vitest';
import {sermonTitleBroadcastLayout} from '@core/themes/sundayScripture';

it('keeps the passage and two-line title inside the broadcast band', () => {
  const layout = sermonTitleBroadcastLayout();
  const band = layout.elements.find(element => element.kind === 'box');
  const reference = layout.elements.find(
    element => element.kind === 'itemName',
  );
  const title = layout.elements.find(element => element.kind === 'currentText');
  if (!band || !reference || !title) throw Error('Missing broadcast title');
  expect(reference.frame.y).toBeGreaterThanOrEqual(band.frame.y);
  expect(reference.frame.y + reference.frame.h).toBeLessThanOrEqual(
    title.frame.y,
  );
  expect(title.frame.y + title.frame.h).toBeLessThanOrEqual(
    band.frame.y + band.frame.h,
  );
  expect(title.text.maxLines).toBe(2);
  expect(title.frame.h).toBeGreaterThanOrEqual(
    title.text.size * title.text.lineHeight * 2,
  );
});
