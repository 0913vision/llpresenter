import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import {MAIN, PROP, TEXT_STYLE} from '../../../main/live/testing/overlays';
import {classes} from './classes';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import {OutputRenderer} from './outputRenderer';

const LAYERS: LiveLayers = {
  ...emptyLayers(),
  media: {mediaId: 'warm-light', loop: true, startedAt: 0},
  slide: {itemId: 'hymn-1', position: 0, label: null, lines: ['만복의 근원']},
  prop: {
    propId: PROP,
    items: [
      {
        propId: PROP,
        content: {kind: 'text', text: '헌금', style: TEXT_STYLE},
        targets: [MAIN],
      },
    ],
  },
};

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('selects one box per layer with the transformed selector, never a box nested in a layer', () => {
  const renderer = new OutputRenderer(document.body, {
    lyricStyle: DEFAULT_LYRIC_STYLE,
    mediaUrl: id => `https://media.test/${id}`,
    onError: vi.fn(),
  });
  renderer.render(LAYERS, {screen: {id: MAIN, kind: 'audience'}});
  const transformed = `.${classes.root} > .${classes.layer}`;
  const boxes = [...document.querySelectorAll(`.${classes.layer}`)];
  const nested = boxes.filter(box => !box.matches(transformed));
  expect(nested.length).toBeGreaterThan(2);
  expect(boxes.filter(box => box.matches(transformed))).toEqual([
    ...document.querySelectorAll('[data-layer]'),
  ]);
  renderer.dispose();
});
