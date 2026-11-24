import {describe, expect, it, vi} from 'vitest';
import {emptyLayers, type SlideLayer} from '@core/schema/live/live';
import {createMediaId, type ThemeId} from '@core/schema/common/ids';
import type {OwnThemeScreen} from '@core/schema/screens/theme';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {drawingOn, liveDrawing} from '@renderer/rendering/theme/drawing';
import {
  shownTexts,
  type ThemeDrawing,
} from '@renderer/rendering/theme/shownTexts';
import {ThemeView} from '@renderer/rendering/theme/themeView';
import {shownText} from '@fixtures/core/liveSlide';
import {
  builtIn,
  THEME_CAPTURE,
  themeOutput,
  THEME_MAIN,
  THEME_STAGE,
} from '@fixtures/core/themeOutput';

const PICTURE = createMediaId('00000000-0000-4000-8000-000000000601');

function drawing(
  id: ThemeId,
  more: Partial<ThemeDrawing> = {},
  kind: 'audience' | 'stage' = 'audience',
): ThemeDrawing {
  const shown = drawingOn(
    {
      theme: builtIn(id),
      screen: {
        id: kind === 'stage' ? THEME_STAGE : THEME_MAIN,
        kind,
        emptyColor: '#123456',
      },
    },
    {content: {texts: {}, auto: {}}, next: null, background: {kind: 'none'}},
  );
  if (shown === null) throw new Error('Nothing to draw');
  return {...shown, ...more};
}

function lyrics(text: string) {
  return drawing(BUILT_IN_THEME_IDS.lyrics, {
    content: {texts: {가사: text}, auto: {}},
  });
}

function setup(options: {readonly transparent?: boolean} = {}) {
  const parent = document.createElement('div');
  const view = new ThemeView(parent, {
    mediaUrl: id => `https://media.test/${id}`,
    onError: vi.fn(),
    ...options,
  });
  const nodes = () => [
    ...parent.querySelectorAll<HTMLElement>('[data-theme-element]'),
  ];
  const texts = () =>
    nodes().flatMap(node =>
      node.hidden || node.dataset['kind'] === 'shape'
        ? []
        : [[...node.children].map(row => row.textContent).join('\n')],
    );
  return {parent, view, nodes, texts};
}

describe('drawing a slide', () => {
  it('shows the rows of its texts', () => {
    const {view, texts} = setup();
    view.draw(lyrics('첫 줄\n둘째 줄'));
    expect(texts()).toEqual(['첫 줄\n둘째 줄']);
  });

  it('keeps its elements while the next slide has the same theme', () => {
    const {view, nodes, texts} = setup();
    view.draw(lyrics('첫 줄'));
    const before = nodes();
    view.draw(lyrics('다음 줄'));
    expect(nodes()).toEqual(before);
    expect(texts()).toEqual(['다음 줄']);
  });

  it('draws the elements of another theme instead', () => {
    const {view, texts} = setup();
    view.draw(lyrics('첫 줄'));
    view.draw(
      drawing(BUILT_IN_THEME_IDS.title, {
        content: {texts: {제목: '찬양', 영문: 'Praise'}, auto: {}},
      }),
    );
    expect(texts()).toEqual(expect.arrayContaining(['찬양', 'Praise']));
  });

  it('shows nothing, or only the empty color', () => {
    const {parent, view, texts} = setup();
    view.draw(lyrics('첫 줄'));
    const backdrop = parent.querySelector<HTMLElement>(
      '[data-theme-view] > div',
    );
    expect(backdrop?.style.background).toContain('rgb(18, 52, 86)');
    view.draw(null);
    expect(
      parent.querySelector<HTMLElement>('[data-theme-view] > div + div')
        ?.hidden,
    ).toBe(true);
    expect(backdrop?.style.background).toBe('transparent');
    view.draw(lyrics('첫 줄'));
    expect(texts()).toEqual(['첫 줄']);
  });

  it('has no color of its own on a transparent screen', () => {
    const {parent, view} = setup({transparent: true});
    view.draw(lyrics('첫 줄'));
    expect(
      parent.querySelector<HTMLElement>('[data-theme-view] > div')?.style
        .background,
    ).toBe('transparent');
  });

  it('puts the place and the size of a background picture on it', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const {parent, view} = setup();
    view.draw({
      ...lyrics('첫 줄'),
      background: {
        kind: 'media',
        media: PICTURE,
        fit: 'fit',
        area: {scale: 2, x: 0.1, y: -0.2},
      },
    });
    const moved = [...parent.querySelectorAll<HTMLElement>('div')].find(node =>
      node.style.transform.includes('translate(10%'),
    );
    expect(moved?.style.transform).toBe('translate(10%, -20%) scale(2)');
  });

  it('shows media the operator chose with the fit and place of its 미디어 속성', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const {parent, view} = setup();
    view.draw({
      ...lyrics('첫 줄'),
      media: {
        mediaId: PICTURE,
        loop: true,
        chosen: true,
        startedAt: 0,
        properties: {
          speed: 1,
          volume: 100,
          audio: false,
          fit: 'fit',
          area: {scale: 0.5, x: -0.25, y: 0},
        },
      },
    });
    const moved = [...parent.querySelectorAll<HTMLElement>('div')].find(node =>
      node.style.transform.includes('scale(0.5)'),
    );
    expect(moved?.style.transform).toBe('translate(-25%, 0%) scale(0.5)');
    expect(
      [...parent.querySelectorAll<HTMLElement>('img, video')].some(
        node => node.style.objectFit === 'contain',
      ),
    ).toBe(true);
  });

  it('fades the texts of the slide apart from its background', () => {
    const {view, nodes} = setup();
    view.draw(lyrics('첫 줄'));
    view.setOpacity({slide: 0.5, media: 1});
    expect(nodes().map(node => node.style.opacity)).toContain('0.5');
    view.setOpacity({slide: 1, media: 0.25});
    expect(nodes().every(node => node.style.opacity === '')).toBe(true);
  });

  it('leaves the page when it is disposed', () => {
    const {parent, view} = setup();
    view.draw(lyrics('첫 줄'));
    view.dispose();
    expect(parent.childElementCount).toBe(0);
  });
});

describe('the texts a screen shows', () => {
  const textsOf = (value: ThemeDrawing) =>
    [...shownTexts(value).values()].map(({rows}) => rows.text);

  it('leaves out a text whose values are missing', () => {
    expect(
      textsOf(
        drawing(BUILT_IN_THEME_IDS.songTitle, {
          content: {texts: {제목: '새 노래'}, auto: {}},
        }),
      ),
    ).toEqual(['새 노래']);
  });

  it('shows no text of a slide that was cleared', () => {
    expect(textsOf({...lyrics('첫 줄'), content: null, next: '다음'})).toEqual(
      [],
    );
  });

  it('says (없음) on 무대 for a slide without lyrics', () => {
    expect(
      textsOf(
        drawing(
          BUILT_IN_THEME_IDS.lyrics,
          {content: {texts: {}, auto: {}}, next: '다음 가사'},
          'stage',
        ),
      ),
    ).toEqual(expect.arrayContaining(['(없음)', '다음 가사']));
  });

  it('puts the label of a slide on its own row above the lyrics on 무대', () => {
    const value = drawing(
      BUILT_IN_THEME_IDS.lyrics,
      {
        content: {
          texts: {가사: '가사'},
          auto: {'새 이름표': '후렴', 이름표: '후렴'},
        },
      },
      'stage',
    );
    expect(textsOf(value)).toEqual(['(후렴)', '가사']);
  });

  it('marks a verse that goes on on the next slide', () => {
    const value = drawing(BUILT_IN_THEME_IDS.scripture, {
      content: {texts: {본문: '태초에'}, auto: {}, continued: true},
    });
    expect(
      [...shownTexts(value).values()].some(({rows}) => rows.continued),
    ).toBe(true);
  });
});

describe('what a screen draws of the live slide', () => {
  const slide: SlideLayer = {
    itemId: 'item',
    position: 0,
    ...shownText('가사'),
    next: '다음 가사',
  };
  const frame = (kind: 'audience' | 'stage' | 'broadcast') => ({
    theme: themeOutput(),
    item: null,
    screen: {
      id:
        kind === 'stage'
          ? THEME_STAGE
          : kind === 'broadcast'
            ? THEME_CAPTURE
            : THEME_MAIN,
      name: 'Screen',
      kind,
    },
  });

  it('draws its texts and the next one in the theme of the screen', () => {
    const layers = {...emptyLayers(), slide};
    const drawn = liveDrawing(layers, frame('stage'), false);
    expect(drawn?.content).toEqual({texts: {가사: '가사'}, auto: {}});
    expect(drawn?.next).toBe('다음 가사');
  });

  it('draws nothing on a screen the theme leaves empty', () => {
    const theme = themeOutput();
    const screens: {broadcast: {mode: 'empty'} | OwnThemeScreen} = {
      broadcast: {mode: 'empty'},
    };
    const drawn = liveDrawing(
      {...emptyLayers(), slide},
      {
        ...frame('broadcast'),
        theme: {
          ...theme,
          theme: {
            ...theme.theme,
            screens: {...theme.theme.screens, ...screens},
          },
        },
      },
      false,
    );
    expect(drawn).toBeNull();
  });

  it('keeps the media that plays apart from the background of 대기 화면', () => {
    expect(liveDrawing(emptyLayers(), frame('audience'), false)?.media).toBe(
      undefined,
    );
    expect(
      liveDrawing({...emptyLayers(), slide}, frame('audience'), false)?.media,
    ).toBeNull();
  });
});
