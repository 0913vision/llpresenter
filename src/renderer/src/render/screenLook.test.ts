import {describe, expect, it} from 'vitest';
import {parseLookId} from '@shared/schema/ids';
import type {LooksFile} from '@shared/schema/looks';
import {
  CAPTIONS,
  MAIN,
  overlayUuid,
  settingsDocument,
  STAGE,
  TEXT_STYLE,
} from '../../../main/live/testing/overlays';
import {DEFAULT_LYRIC_STYLE} from './lyricStyle';
import {resolveScreenLook, showsLayer} from './screenLook';

const NORMAL = lookIdOf(70);
const SERMON = lookIdOf(71);
const DELETED = lookIdOf(72);
const LOWER_THIRD = overlayUuid(73);
const MISSING_STYLE = overlayUuid(74);
const GREEN = '#00B140';

function lookIdOf(id: number) {
  const parsed = parseLookId(overlayUuid(id));
  if (!parsed.ok) throw new Error('Invalid Look fixture id');
  return parsed.value;
}

function looks(): LooksFile {
  const document = settingsDocument('looks', {
    current: NORMAL,
    looks: [
      {
        id: NORMAL,
        name: '평상시',
        screens: {
          [MAIN]: {layers: {media: true, slide: true, message: true}},
          [CAPTIONS]: {
            layers: {media: true, slide: true},
            lyricStyle: LOWER_THIRD,
            background: {kind: 'color', color: GREEN},
          },
          [STAGE]: {layers: {slide: true, stageMessage: true}},
        },
      },
      {
        id: SERMON,
        name: '설교',
        screens: {[MAIN]: {layers: {media: true}, lyricStyle: MISSING_STYLE}},
      },
    ],
    lyricStyles: [
      {...TEXT_STYLE, id: LOWER_THIRD, name: '하단 자막', vAlign: 'bottom'},
    ],
  });
  if (document.name !== 'looks') throw new Error('Invalid looks fixture');
  return document.value;
}

describe('screen Look resolution', () => {
  it('draws as before Looks while the Looks are unknown', () => {
    expect(resolveScreenLook(null, NORMAL, MAIN)).toEqual({
      appearance: null,
      gap: null,
    });
  });

  it('takes the card of the live Look, with its lyric style and background', () => {
    expect(resolveScreenLook(looks(), NORMAL, CAPTIONS)).toEqual({
      appearance: {
        layers: {media: true, slide: true},
        lyricStyle: looks().lyricStyles[0],
        background: GREEN,
      },
      gap: null,
    });
    expect(resolveScreenLook(looks(), NORMAL, MAIN).appearance).toEqual({
      layers: {media: true, slide: true, message: true},
      lyricStyle: DEFAULT_LYRIC_STYLE,
      background: null,
    });
  });

  it('falls back to the saved current Look for no or a deleted live Look', () => {
    const current = resolveScreenLook(looks(), NORMAL, STAGE);
    expect(resolveScreenLook(looks(), DELETED, STAGE)).toEqual(current);
    expect(resolveScreenLook(looks(), null, STAGE)).toEqual(current);
    expect(resolveScreenLook(looks(), undefined, STAGE)).toEqual(current);
  });

  it('draws as before Looks when the current Look is gone too', () => {
    const orphaned = {...looks(), current: DELETED};
    expect(resolveScreenLook(orphaned, DELETED, MAIN)).toEqual({
      appearance: null,
      gap: null,
    });
  });

  it('draws a screen without a card as before Looks and names the gap', () => {
    expect(resolveScreenLook(looks(), SERMON, STAGE)).toEqual({
      appearance: null,
      gap: {kind: 'no-card', id: SERMON},
    });
  });

  it('draws a missing lyric style with 기본 and names the gap', () => {
    expect(resolveScreenLook(looks(), SERMON, MAIN)).toEqual({
      appearance: {
        layers: {media: true},
        lyricStyle: DEFAULT_LYRIC_STYLE,
        background: null,
      },
      gap: {kind: 'missing-style', id: MISSING_STYLE},
    });
  });
});

describe('Look layer switches', () => {
  it('show every layer without a Look', () => {
    expect(showsLayer(null, 'notice')).toBe(true);
  });

  it('hide an absent switch and the media behind a color background', () => {
    const captions = resolveScreenLook(looks(), NORMAL, CAPTIONS).appearance;
    const main = resolveScreenLook(looks(), NORMAL, MAIN).appearance;
    expect(showsLayer(main, 'media')).toBe(true);
    expect(showsLayer(main, 'notice')).toBe(false);
    expect(showsLayer(captions, 'media')).toBe(false);
    expect(showsLayer(captions, 'slide')).toBe(true);
  });
});
