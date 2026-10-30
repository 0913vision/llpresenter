import {beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {failProbeDuring} from './fixtures/layers/probe';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import {OutputRenderer} from './outputRenderer';

vi.mock('./layers', () => import('./fixtures/layers'));

class FakeResizeObserver {
  static readonly instances: FakeResizeObserver[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

const layers = {
  ...emptyLayers(),
  message: {messageId: 'fixture', text: 'registered layer'},
};

beforeEach(() => {
  failProbeDuring(null);
  FakeResizeObserver.instances.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(960);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(540);
});

function setUp() {
  const parent = document.createElement('div');
  const onError = vi.fn();
  const renderer = new OutputRenderer(parent, {
    lyricStyle: DEFAULT_LYRIC_STYLE,
    mediaUrl: id => id,
    onError,
  });
  return {parent, renderer, onError};
}

describe('layer module discovery through OutputRenderer', () => {
  it('creates, draws, rescales and releases added fixture layers without registration entries', () => {
    const {parent, renderer, onError} = setUp();
    const boxes = [...parent.querySelectorAll<HTMLElement>('[data-layer]')];
    expect(boxes.map(box => box.dataset['layer'])).toEqual([
      'fixture',
      'fixture-healthy',
    ]);
    expect(boxes.map(box => box.style.zIndex)).toEqual(['7', '9']);
    const pictures = [...parent.querySelectorAll('output')];
    renderer.render(layers);
    renderer.render(layers);
    expect([...parent.querySelectorAll('output')]).toEqual(pictures);
    expect(pictures.map(picture => picture.textContent)).toEqual([
      'registered layer',
      'registered layer',
    ]);
    expect(pictures.map(picture => picture.dataset['scale'])).toEqual([
      '0.5',
      '0.5',
    ]);
    expect(onError).not.toHaveBeenCalled();
    renderer.dispose();
    renderer.dispose();
    expect(pictures.map(picture => picture.dataset['disposed'])).toEqual([
      'true',
      'true',
    ]);
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
    expect(parent.childElementCount).toBe(0);
  });

  it.each(['create', 'draw', 'rescale', 'dispose'] as const)(
    'isolates a fixture %s failure from later layers and cleanup',
    phase => {
      if (phase === 'create') failProbeDuring(phase);
      const {parent, renderer, onError} = setUp();
      const healthy = parent.querySelector<HTMLOutputElement>(
        '[data-layer="fixture-healthy"] output',
      );
      failProbeDuring(phase);
      renderer.render(layers);
      FakeResizeObserver.instances[0]?.callback();
      expect(healthy?.textContent).toBe('registered layer');
      expect(healthy?.dataset['scale']).toBe('0.5');
      renderer.dispose();
      expect(healthy?.dataset['disposed']).toBe('true');
      expect(parent.childElementCount).toBe(0);
      expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
      const operation = phase === 'rescale' ? 'draw' : phase;
      expect(onError).toHaveBeenCalledWith(
        `could not ${operation} the fixture layer`,
        expect.any(Error),
      );
      if (phase === 'create') {
        expect(parent.querySelector('[data-layer="fixture"]')).toBeNull();
      }
    },
  );
});
