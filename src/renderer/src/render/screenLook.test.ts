import {describe, expect, it} from 'vitest';
import {parseLookId} from '@shared/schema/ids';
import type {LooksFile} from '@shared/schema/looks';
import {
  CAPTIONS,
  MAIN,
  overlayUuid,
  settingsDocument,
  STAGE,
} from '../../../main/live/testing/overlays';
import {DEFAULT_LYRIC_STYLE, renderLyricStyle} from './lyricStyle';
import {DEFAULT_MESSAGE_STYLE} from '@shared/schema/looks';
import {resolveScreenLook, showsLayer} from './screenLook';

const NORMAL = lookIdOf(70);
const SERMON = lookIdOf(71);
const DELETED = lookIdOf(72);
const LOWER_THIRD = overlayUuid(73);
const MISSING_STYLE = overlayUuid(74);
const GREEN = '#00B140';
const MAIN_SCREEN = {id: MAIN, kind: 'audience'} as const;
const CAPTIONS_SCREEN = {id: CAPTIONS, kind: 'audience'} as const;
const STAGE_SCREEN = {id: STAGE, kind: 'stage'} as const;

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
      {
        ...DEFAULT_MESSAGE_STYLE,
        id: LOWER_THIRD,
        name: 'Caption',
        vAlign: 'bottom',
        referencePosition: 'bottomRight',
      },
    ],
  });
  if (document.name !== 'looks') throw new Error('Invalid looks fixture');
  return document.value;
}

describe('screen Look resolution', () => {
  it('resolves each screen’s selected message style and falls back when missing', () => {
    const original = looks();
    const document = settingsDocument('looks', {
      ...original,
      looks: original.looks.map(look =>
        look.id === NORMAL
          ? {
              ...look,
              screens: {
                ...look.screens,
                [MAIN]: {...look.screens[MAIN], messageStyle: overlayUuid(90)},
                [CAPTIONS]: {
                  ...look.screens[CAPTIONS],
                  messageStyle: overlayUuid(91),
                },
                [STAGE]: {
                  ...look.screens[STAGE],
                  messageStyle: overlayUuid(92),
                },
              },
            }
          : look,
      ),
      messageStyles: [
        {
          ...DEFAULT_MESSAGE_STYLE,
          id: overlayUuid(90),
          color: '#FF0000',
          outline: {on: true, width: 7, color: '#123456'},
          shadow: {...DEFAULT_MESSAGE_STYLE.shadow, blur: 19, color: '#654321'},
        },
        {...DEFAULT_MESSAGE_STYLE, id: overlayUuid(91), color: '#0000FF'},
      ],
    });
    if (document.name !== 'looks') throw new Error('Invalid looks fixture');
    expect(
      resolveScreenLook(document.value, NORMAL, MAIN_SCREEN).appearance
        ?.messageStyle?.color,
    ).toBe('#FF0000');
    expect(
      resolveScreenLook(document.value, NORMAL, MAIN_SCREEN).appearance
        ?.messageStyle,
    ).toMatchObject({
      outline: {on: true, width: 7, color: '#123456'},
      shadow: {blur: 19, color: '#654321'},
    });
    expect(
      resolveScreenLook(document.value, NORMAL, CAPTIONS_SCREEN).appearance
        ?.messageStyle?.color,
    ).toBe('#0000FF');
    expect(
      resolveScreenLook(document.value, NORMAL, STAGE_SCREEN).appearance
        ?.messageStyle?.color,
    ).toBe(DEFAULT_MESSAGE_STYLE.color);
  });
  it('draws as before Looks while the Looks are unknown', () => {
    expect(resolveScreenLook(null, NORMAL, MAIN_SCREEN)).toEqual({
      appearance: null,
      gap: null,
    });
  });

  it('takes the card of the live Look, with its lyric style and background', () => {
    const style = looks().lyricStyles[0];
    if (style === undefined) throw new Error('Missing style');
    expect(resolveScreenLook(looks(), NORMAL, CAPTIONS_SCREEN)).toEqual({
      appearance: {
        layers: {media: true, slide: true},
        lyricStyle: renderLyricStyle(style),
        background: GREEN,
      },
      gap: null,
    });
    expect(resolveScreenLook(looks(), NORMAL, MAIN_SCREEN).appearance).toEqual({
      layers: {media: true, slide: true, message: true},
      lyricStyle: DEFAULT_LYRIC_STYLE,
      background: null,
    });
  });

  it('passes the saved outline and shadow details to the renderer', () => {
    const style = resolveScreenLook(looks(), NORMAL, CAPTIONS_SCREEN).appearance
      ?.lyricStyle;
    expect(style?.outline).toEqual(DEFAULT_MESSAGE_STYLE.outline);
    expect(style?.shadow).toEqual(DEFAULT_MESSAGE_STYLE.shadow);
  });

  it('falls back to the saved current Look for no or a deleted live Look', () => {
    const current = resolveScreenLook(looks(), NORMAL, STAGE_SCREEN);
    expect(resolveScreenLook(looks(), DELETED, STAGE_SCREEN)).toEqual(current);
    expect(resolveScreenLook(looks(), null, STAGE_SCREEN)).toEqual(current);
    expect(resolveScreenLook(looks(), undefined, STAGE_SCREEN)).toEqual(
      current,
    );
  });

  it('draws as before Looks when the current Look is gone too', () => {
    const orphaned = {...looks(), current: DELETED};
    expect(resolveScreenLook(orphaned, DELETED, MAIN_SCREEN)).toEqual({
      appearance: null,
      gap: null,
    });
  });

  it('draws a screen without a card as before Looks and names the gap', () => {
    expect(resolveScreenLook(looks(), SERMON, STAGE_SCREEN)).toEqual({
      appearance: null,
      gap: {kind: 'no-card', id: SERMON},
    });
  });

  it('draws a 무대 화면 with 기본 whatever lyric style its card names', () => {
    const turnedStage = {...CAPTIONS_SCREEN, kind: 'stage'} as const;
    expect(resolveScreenLook(looks(), NORMAL, turnedStage)).toEqual({
      appearance: {
        layers: {media: true, slide: true},
        lyricStyle: DEFAULT_LYRIC_STYLE,
        background: GREEN,
      },
      gap: null,
    });
    const missing = {...MAIN_SCREEN, kind: 'stage'} as const;
    expect(resolveScreenLook(looks(), SERMON, missing).gap).toBeNull();
  });

  it('draws a missing lyric style with 기본 and names the gap', () => {
    expect(resolveScreenLook(looks(), SERMON, MAIN_SCREEN)).toEqual({
      appearance: {
        layers: {media: true},
        lyricStyle: DEFAULT_LYRIC_STYLE,
        background: null,
      },
      gap: {kind: 'missing-style', id: MISSING_STYLE},
    });
  });
});

describe('stage layouts in a Look', () => {
  it('reads the card layout for a 무대 화면 only', () => {
    const layout = overlayUuid(75);
    const document = settingsDocument('looks', {
      current: NORMAL,
      looks: [
        {
          id: NORMAL,
          name: '평상시',
          screens: {
            [MAIN]: {layers: {slide: true}, stageLayout: layout},
            [STAGE]: {layers: {slide: true}, stageLayout: layout},
          },
        },
      ],
      lyricStyles: [],
    });
    if (document.name !== 'looks') throw new Error('Invalid looks fixture');
    expect(
      resolveScreenLook(document.value, NORMAL, STAGE_SCREEN).appearance
        ?.stageLayout,
    ).toBe(layout);
    expect(
      resolveScreenLook(document.value, NORMAL, MAIN_SCREEN).appearance,
    ).not.toHaveProperty('stageLayout');
  });
});

describe('Look layer switches', () => {
  it('show every layer without a Look', () => {
    expect(showsLayer(null, 'notice')).toBe(true);
  });

  it('hide an absent switch and the media behind a color background', () => {
    const captions = resolveScreenLook(
      looks(),
      NORMAL,
      CAPTIONS_SCREEN,
    ).appearance;
    const main = resolveScreenLook(looks(), NORMAL, MAIN_SCREEN).appearance;
    expect(showsLayer(main, 'media')).toBe(true);
    expect(showsLayer(main, 'notice')).toBe(false);
    expect(showsLayer(captions, 'media')).toBe(false);
    expect(showsLayer(captions, 'slide')).toBe(true);
  });
});
