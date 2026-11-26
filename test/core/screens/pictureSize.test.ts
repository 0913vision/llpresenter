import {expect, it} from 'vitest';
import type {Screen} from '@core/schema/screens/screens';
import {pictureBounds, pictureSizeForScreen} from '@core/screens/pictureSize';
import {screensDocument} from '@fixtures/core/screenDocuments';

function screens(): readonly Screen[] {
  const document = screensDocument();
  if (document.name !== 'screens') throw new Error('Not screens');
  return document.value.screens;
}

function screenOf(index: number): Screen {
  const screen = screens()[index];
  if (screen === undefined) throw new Error(`No screen ${index}`);
  return screen;
}

it('sizes a full screen output by its monitor, and one without a monitor not at all', () => {
  expect(pictureSizeForScreen(screenOf(0))).toEqual({
    width: 1920,
    height: 1080,
  });
  expect(pictureSizeForScreen(screenOf(2))).toBeUndefined();
});

it('sizes a capture by its resolution, an NDI output by its own, and a window not at all', () => {
  const capture = screenOf(1);
  expect(pictureSizeForScreen(capture)).toBeUndefined();
  expect(
    pictureSizeForScreen({...capture, resolution: {width: 1280, height: 720}}),
  ).toEqual({width: 1280, height: 720});
  expect(
    pictureSizeForScreen({
      ...capture,
      method: 'ndi',
      ndi: {resolution: {width: 3840, height: 2160}},
    }),
  ).toEqual({width: 3840, height: 2160});
  expect(pictureSizeForScreen({...capture, method: 'window'})).toBeUndefined();
});

it('fills the 16:9 preview with a picture of no size or its own shape', () => {
  const full = {x: 0, y: 0, width: 1920, height: 1080};
  expect(pictureBounds(undefined)).toEqual(full);
  expect(pictureBounds({width: 3840, height: 2160})).toEqual(full);
});

it('puts a 4:3 picture between bars at the sides, and a wide one between bars above and below', () => {
  expect(pictureBounds({width: 1024, height: 768})).toEqual({
    x: 240,
    y: 0,
    width: 1440,
    height: 1080,
  });
  expect(pictureBounds({width: 2560, height: 1080})).toEqual({
    x: 0,
    y: 135,
    width: 1920,
    height: 810,
  });
});
