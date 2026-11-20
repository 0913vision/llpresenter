import {expect, it} from 'vitest';
import {sermonTitleBroadcastLayout} from '@core/themes/sundayScripture';

it('places the measured title ink 20px apart with 40px band padding', () => {
  const layout = sermonTitleBroadcastLayout();
  const band = layout.elements.find(element => element.kind === 'box');
  const reference = layout.elements.find(element => element.kind === 'itemName');
  const title = layout.elements.find(element => element.kind === 'currentText');
  if (!band || !reference || !title) throw Error('Missing broadcast title');
  expect(reference.frame.h).toBe(42);
  expect(title.frame.h).toBe(154);
  expect(reference.text).toMatchObject({size: 38, vAlign: 'middle'});
  expect(title.text).toMatchObject({size: 64, vAlign: 'middle'});

  // NOTE(0913vision): Ink bounds came from the 1920x1080 main capture.
  const referenceTop = 784 + reference.frame.y - 781;
  const referenceBottom = 817 + reference.frame.y - 781;
  const titleTop = 872 + title.frame.y - 826;
  const titleBottom = 932 + title.frame.y - 826;
  expect(referenceTop - band.frame.y).toBe(40);
  expect(titleTop - referenceBottom).toBe(20);
  expect(band.frame.y + band.frame.h - titleBottom).toBe(40);
});
