import {expect, it, vi} from 'vitest';
import {SlideLayerView} from '@renderer/rendering/slideLayer';
import {classes} from '@renderer/rendering/classes';
import {DEFAULT_TEXT_STYLE, type TextStyle} from '@core/themes/textStyle';
import type {SlideLayer} from '@core/live/state';

const SLIDE: SlideLayer = {
  itemId: 'song',
  position: 0,
  label: null,
  lines: ['Repeated text'],
};

function setup() {
  const doc = document.implementation.createHTMLDocument();
  const fonts: {status: 'loaded' | 'loading'; ready: Promise<unknown>} = {
    status: 'loaded',
    ready: Promise.resolve(),
  };
  Object.defineProperty(doc, 'fonts', {value: fonts});
  const parent = doc.createElement('div');
  doc.body.append(parent);
  const width = vi
    .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockReturnValue(200);
  const height = vi
    .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockReturnValue(60);
  const measure = vi
    .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return Number.parseFloat(this.style.fontSize) * this.textContent.length;
    });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(40);
  const view = new SlideLayerView(parent, DEFAULT_TEXT_STYLE);
  const block = () =>
    parent.querySelector<HTMLElement>(`.${classes.shown} .${classes.block}`);
  return {view, parent, fonts, width, height, measure, block};
}

it('reuses a bounded fit across both slide pages and applies the cached size', () => {
  const {view, measure, block} = setup();
  view.show(SLIDE, false);
  const fitted = block()?.style.fontSize;
  expect(Number.parseFloat(fitted ?? '')).toBeLessThan(DEFAULT_TEXT_STYLE.size);
  view.show({...SLIDE, position: 1, lines: ['Other']}, false);
  measure.mockClear();
  view.show(SLIDE, false);
  expect(measure).not.toHaveBeenCalled();
  expect(block()?.style.fontSize).toBe(fitted);
  view.replaceLines(SLIDE.lines);
  expect(measure).not.toHaveBeenCalled();
  view.dispose();
});

it.each<Partial<TextStyle>>([
  {font: 'Different'},
  {weight: 600},
  {size: 60},
  {lineHeight: 1.6},
  {tracking: -3},
  {shortTracking: {maxCharacters: 30, tracking: -2}},
  {margin: 10},
  {bullets: true},
  {bulletStyle: 'disc'},
  {align: 'left'},
])('refits changed text style %j', change => {
  const {view, measure} = setup();
  view.show(SLIDE, false);
  measure.mockClear();
  view.setStyle({...DEFAULT_TEXT_STYLE, ...change});
  expect(measure).toHaveBeenCalled();
  view.dispose();
});

it('refits changed frame dimensions and output scale', () => {
  const {view, width, height, measure} = setup();
  view.show(SLIDE, false);
  for (const change of [
    () => width.mockReturnValue(300),
    () => height.mockReturnValue(80),
  ]) {
    change();
    measure.mockClear();
    view.rescale(1);
    expect(measure).toHaveBeenCalled();
  }
  measure.mockClear();
  view.rescale(0.5);
  expect(measure).toHaveBeenCalled();
  view.dispose();
});

it('keeps continuation and Bible paragraph identity in a fit and restores marker sizes on reuse', () => {
  const {view, measure, block} = setup();
  const continued = {
    ...SLIDE,
    lines: ['Text (계속)'],
    continued: true,
    biblePart: 1,
  };
  view.show(continued, false);
  const markerSize = block()?.querySelector<HTMLElement>(
    '[data-bible-continuation]',
  )?.style.fontSize;
  expect(markerSize).toBeTruthy();
  measure.mockClear();
  view.show({...continued, continued: false}, false);
  expect(measure).toHaveBeenCalled();
  measure.mockClear();
  view.show({...continued, biblePart: 2}, false);
  expect(measure).toHaveBeenCalled();
  measure.mockClear();
  view.show(continued, false);
  expect(measure).not.toHaveBeenCalled();
  expect(
    block()?.querySelector<HTMLElement>('[data-bible-continuation]')?.style
      .fontSize,
  ).toBe(markerSize);
  view.dispose();
});

it('bypasses fits while fonts load and invalidates on a new font readiness cycle', () => {
  const {view, measure, fonts} = setup();
  view.show(SLIDE, false);
  fonts.status = 'loading';
  fonts.ready = Promise.resolve();
  measure.mockClear();
  view.replaceLines(SLIDE.lines);
  expect(measure).toHaveBeenCalled();
  measure.mockClear();
  view.replaceLines(SLIDE.lines);
  expect(measure).toHaveBeenCalled();
  fonts.status = 'loaded';
  measure.mockClear();
  view.replaceLines(SLIDE.lines);
  expect(measure).toHaveBeenCalled();
  measure.mockClear();
  view.replaceLines(SLIDE.lines);
  expect(measure).not.toHaveBeenCalled();
  fonts.ready = Promise.resolve();
  view.replaceLines(SLIDE.lines);
  expect(measure).toHaveBeenCalled();
  view.dispose();
});
