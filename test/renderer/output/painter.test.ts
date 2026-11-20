import {afterEach, expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {createThemeId} from '@core/schema/ids';
import type {PictureRequest} from '@core/schema/picture';
import {THEME_MAIN, themeElementBase} from '@fixtures/core/themeOutput';
import {startPainter} from '@renderer/output/painter';
import {classes} from '@renderer/rendering/classes';
import {ThemeCompositionView} from '@renderer/rendering/themeComposition';
import {ThemeElementView} from '@renderer/rendering/themeElement';

declare global {
  interface Window {
    drawPicture?: (request: PictureRequest) => Promise<void>;
  }
}

function picture(
  reference: string,
  position: number,
  line: string,
): PictureRequest {
  const id = `bible:test:${reference}`;
  return {
    inputs: '',
    spec: {
      layers: {
        ...emptyLayers(),
        slide: {itemId: id, position, label: null, lines: [line], reference},
      },
      appearance: {
        screen: {id: THEME_MAIN, kind: 'audience', method: 'fullscreen'},
        theme: {
          themeId: createThemeId('00000000-0000-4000-8000-000000000001'),
          revision: 1,
          missing: [],
          item: {id, kind: 'bible', source: 'external', title: reference},
          sourceScreenId: THEME_MAIN,
          layout: {
            mode: {kind: 'own'},
            elements: [{...themeElementBase(), kind: 'currentText'}],
          },
          emptyColor: '#000000',
        },
        background: '#000000',
        checker: false,
      },
    },
  };
}

afterEach(() => {
  delete window.drawPicture;
  vi.useRealTimers();
});

function failDraw(): never {
  throw new Error('Injected draw failure');
}

it.each([
  {
    name: 'theme layer',
    fail: () =>
      vi
        .spyOn(ThemeCompositionView.prototype, 'render')
        .mockImplementationOnce(failDraw),
  },
  {
    name: 'theme element',
    fail: () =>
      vi
        .spyOn(ThemeElementView.prototype, 'render')
        .mockImplementationOnce(failDraw),
  },
])(
  'rejects a failed $name draw before capture and allows retry',
  async ({fail}) => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = document.createElement('div');
    startPainter(root);
    const draw = window.drawPicture;
    if (draw === undefined) {
      throw new Error('Picture painter entry point is missing');
    }
    const shownText = () =>
      root.querySelector(`[data-kind="currentText"] .${classes.shown}`)
        ?.textContent;

    const previous = picture('Genesis 3:4-21', 22, 'Previous passage');
    const incoming = picture('Obadiah 1:4-21', 0, 'Incoming passage');
    await Promise.all([draw(previous), vi.advanceTimersByTimeAsync(100)]);
    expect(shownText()).toBe('Previous passage');

    fail();
    await Promise.all([
      expect(draw(incoming)).rejects.toThrow('could not draw'),
      vi.advanceTimersByTimeAsync(100),
    ]);
    expect(root.childElementCount).toBe(0);

    await Promise.all([draw(incoming), vi.advanceTimersByTimeAsync(100)]);
    expect(shownText()).toBe('Incoming passage');
  },
);
