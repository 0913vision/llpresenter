import {afterEach, expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {createThemeId} from '@core/schema/ids';
import type {PictureRequest} from '@core/schema/picture';
import {broadcastLookLayout} from '@core/themes/broadcastLook';
import {
  THEME_CAPTURE,
  THEME_MAIN,
  themeElementBase,
} from '@fixtures/core/themeOutput';
import {startPainter} from '@renderer/output/painter';
import {classes} from '@renderer/rendering/classes';
import {ThemeCompositionView} from '@renderer/rendering/themeComposition';
import {ThemeElementView} from '@renderer/rendering/themeElement';

declare global {
  interface Window {
    drawPicture?: (request: PictureRequest) => Promise<void>;
  }
}

function picture({
  reference,
  position,
  line,
  kind = 'audience',
}: {
  reference: string;
  position: number;
  line: string;
  kind?: 'audience' | 'broadcast';
}): PictureRequest {
  const id = `bible:test:${reference}`;
  const broadcast = kind === 'broadcast';
  const screenId = broadcast ? THEME_CAPTURE : THEME_MAIN;
  return {
    inputs: '',
    spec: {
      layers: {
        ...emptyLayers(),
        slide: {itemId: id, position, label: null, lines: [line], reference},
      },
      appearance: {
        screen: {
          id: screenId,
          kind,
          method: broadcast ? 'capture' : 'fullscreen',
        },
        theme: {
          themeId: createThemeId('00000000-0000-4000-8000-000000000001'),
          revision: 1,
          missing: [],
          item: {id, kind: 'bible', source: 'external', title: reference},
          sourceScreenId: screenId,
          layout: broadcast
            ? broadcastLookLayout('plain')
            : {
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

function setupPainter() {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const root = document.createElement('div');
  startPainter(root);
  const draw = window.drawPicture;
  if (draw === undefined) {
    throw new Error('Picture painter entry point is missing');
  }
  return {root, draw};
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
    const {root, draw} = setupPainter();
    const shownText = () =>
      root.querySelector(`[data-kind="currentText"] .${classes.shown}`)
        ?.textContent;

    const previous = picture({
      reference: 'Genesis 3:4-21',
      position: 22,
      line: 'Previous passage',
    });
    const incoming = picture({
      reference: 'Obadiah 1:4-21',
      position: 0,
      line: 'Incoming passage',
    });
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

it('rejects a failed broadcast fit before capturing the previous Bible reference', async () => {
  const {root, draw} = setupPainter();
  const shownReference = () =>
    root.querySelector(`[data-kind="reference"] .${classes.shown}`)
      ?.textContent;
  const previous = picture({
    reference: 'Genesis 3:4-21',
    position: 22,
    line: 'Previous verse',
    kind: 'broadcast',
  });
  const incoming = picture({
    reference: 'Obadiah 1:4-21',
    position: 0,
    line: 'Incoming verse',
    kind: 'broadcast',
  });
  await Promise.all([draw(previous), vi.advanceTimersByTimeAsync(100)]);
  expect(shownReference()).toBe('Genesis 3:4-21');

  let injectFailure = true;
  const height = vi
    .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
    .mockImplementation(function (this: HTMLElement) {
      if (injectFailure && this.closest('[data-slide-measure]') !== null) {
        injectFailure = false;
        failDraw();
      }
      return 0;
    });
  const capture = draw(incoming).then(shownReference);
  await Promise.all([
    expect(capture).rejects.toThrow('could not fit the broadcast band'),
    vi.advanceTimersByTimeAsync(100),
  ]);
  expect(injectFailure).toBe(false);
  expect(root.childElementCount).toBe(0);
  height.mockRestore();

  await Promise.all([draw(incoming), vi.advanceTimersByTimeAsync(100)]);
  expect(shownReference()).toBe('Obadiah 1:4-21');
});
