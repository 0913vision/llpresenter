import {beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import type {RenderMode} from '@renderer/rendering/backgroundLayer';
import {classes} from '@renderer/rendering/classes';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {SlideLayerView} from '@renderer/rendering/slideLayer';
import {MAIN} from '@fixtures/core/overlays';

class MockResizeObserver {
  static readonly instances: MockResizeObserver[] = [];
  observed: Element | null = null;
  disconnected = false;

  constructor(readonly callback: () => void) {
    MockResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed = target;
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

const WITH_SLIDE: LiveLayers = {
  ...emptyLayers(),
  media: {mediaId: 'warm-light', loop: true, startedAt: Date.now()},
  slide: {itemId: 'hymn-1', position: 0, label: null, lines: ['만복의 근원']},
};

beforeEach(() => {
  MockResizeObserver.instances.length = 0;
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});

function setUp({mode}: {mode?: RenderMode} = {}) {
  const parent = document.createElement('div');
  const onError = vi.fn();
  const renderer = new OutputRenderer(parent, {
    textStyle: DEFAULT_TEXT_STYLE,
    mediaUrl: mediaId => `https://media.test/${mediaId}.jpg`,
    onError,
    ...(mode === undefined ? {} : {mode}),
  });
  return {parent, renderer, onError};
}

describe('OutputRenderer', () => {
  it('detects moving videos and CSS animations but leaves a static picture idle', () => {
    const {parent, renderer} = setUp();
    expect(renderer.moving()).toBe(false);
    const root = parent.firstElementChild;
    if (!(root instanceof HTMLElement)) throw new Error('Missing render root');
    const getAnimations = vi.fn(() => [{playState: 'running', pending: false}]);
    Object.defineProperty(root, 'getAnimations', {value: getAnimations});
    expect(renderer.moving()).toBe(true);
    getAnimations.mockReturnValue([{playState: 'finished', pending: false}]);
    expect(renderer.moving()).toBe(false);
    const video = document.createElement('video');
    root.append(video);
    Object.defineProperty(video, 'paused', {configurable: true, value: false});
    expect(renderer.moving()).toBe(true);
    Object.defineProperty(video, 'paused', {value: true});
    expect(renderer.moving()).toBe(false);
    renderer.dispose();
    expect(renderer.moving()).toBe(false);
  });
  it('fades cleared lyrics on the monotonic frame clock and cancels on restore or disposal', () => {
    vi.useFakeTimers();
    try {
      let now = 1000;
      const frame = {
        timers: {list: [], runs: undefined, now: () => ({timer: now, wall: 0})},
      };
      const {parent, renderer} = setUp();
      const lyrics = parent.querySelector<HTMLElement>('[data-layer="lyrics"]');
      const shown = {...WITH_SLIDE, media: null};
      renderer.render(shown, frame);
      const cleared = {...shown, slide: null};
      const effect = {
        target: {kind: 'layer', layer: 'slide'},
        since: 1000,
        durationMs: 1200,
      } as const;
      renderer.render(cleared, {...frame, clearEffects: [effect]});
      expect(renderer.moving()).toBe(true);
      now = 1600;
      vi.advanceTimersByTime(32);
      expect(Number(lyrics?.style.opacity)).toBeCloseTo(0.5);
      expect(lyrics?.querySelector(`.${classes.shown}`)?.textContent).toContain(
        '만복의 근원',
      );
      renderer.render(shown, frame);
      expect(lyrics?.style.opacity).toBe('');
      renderer.render(cleared, {
        ...frame,
        clearEffects: [{...effect, since: now}],
      });
      now = 2800;
      vi.advanceTimersByTime(32);
      expect(lyrics?.querySelector(`.${classes.shown}`)).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      renderer.render(shown, frame);
      renderer.render(cleared, {
        ...frame,
        clearEffects: [{...effect, since: now}],
      });
      renderer.dispose();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mounts the current frame instantly and enables transitions for subsequent content', () => {
    const {parent, renderer} = setUp();
    const root = parent.firstElementChild;
    renderer.render(WITH_SLIDE);
    expect(root?.classList.contains(classes.instant)).toBe(true);
    renderer.render(WITH_SLIDE, {testPattern: false});
    expect(root?.classList.contains(classes.instant)).toBe(true);
    renderer.render({...WITH_SLIDE, slide: null});
    expect(root?.classList.contains(classes.instant)).toBe(false);
    renderer.render(WITH_SLIDE, {transitions: false});
    expect(root?.classList.contains(classes.instant)).toBe(true);
    renderer.dispose();
  });

  it('keeps the current picture instant through a screen redraw, but not through new content', () => {
    const {parent, renderer} = setUp();
    const root = parent.firstElementChild;
    const screen = {id: MAIN, kind: 'audience', method: 'window'} as const;
    renderer.render(WITH_SLIDE, {screen});
    expect(root?.classList.contains(classes.instant)).toBe(true);

    renderer.render(WITH_SLIDE, {screen: {...screen, method: 'capture'}});
    expect(root?.classList.contains(classes.instant)).toBe(true);
    renderer.render({...WITH_SLIDE, slide: null}, {screen});

    expect(root?.classList.contains(classes.instant)).toBe(false);
    renderer.dispose();
  });

  it('switches the empty color between chroma and black without replacing the content', () => {
    const {parent, renderer} = setUp();
    const frame = {
      screen: {id: MAIN, kind: 'audience', method: 'capture'},
    } as const;
    renderer.render({...emptyLayers(), slide: WITH_SLIDE.slide}, frame);
    const root = parent.firstElementChild;
    const shown = parent.querySelector(`.${classes.page}.${classes.shown}`);
    expect(
      root instanceof HTMLElement &&
        root.style.getPropertyValue('--output-background'),
    ).toBe('var(--chroma)');
    renderer.render(
      {...emptyLayers(), slide: WITH_SLIDE.slide},
      {screen: {...frame.screen, method: 'window'}},
    );
    expect(
      root instanceof HTMLElement &&
        root.style.getPropertyValue('--output-background'),
    ).toBe('');
    expect(parent.firstElementChild).toBe(root);
    expect(parent.querySelector(`.${classes.page}.${classes.shown}`)).toBe(
      shown,
    );
    renderer.dispose();
  });

  it.each<RenderMode>(['output', 'preview'])(
    'updates the saved empty color without replacing layers in %s',
    mode => {
      const {parent, renderer} = setUp({mode});
      const screen = {
        id: MAIN,
        kind: 'audience',
        method: 'capture',
        emptyColor: '#123456',
      } as const;
      renderer.render(WITH_SLIDE, {screen});
      const root = parent.firstElementChild;
      expect(
        root instanceof HTMLElement &&
          root.style.getPropertyValue('--output-background'),
      ).toBe('#123456');
      renderer.render(WITH_SLIDE, {screen: {...screen, emptyColor: '#654321'}});
      expect(
        root instanceof HTMLElement &&
          root.style.getPropertyValue('--output-background'),
      ).toBe('#654321');
      expect(parent.firstElementChild).toBe(root);
      renderer.dispose();
    },
  );

  it.each<RenderMode>(['output', 'preview'])(
    'draws an image under the lyrics and clears it in the same call in %s mode',
    async mode => {
      vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
        new DOMException('The source is an image', 'NotSupportedError'),
      );
      const parent = document.createElement('div');
      const onError = vi.fn();
      const renderer = new OutputRenderer(parent, {
        textStyle: DEFAULT_TEXT_STYLE,
        mediaUrl: mediaId => `llp-media://media/${mediaId}`,
        onError,
        mode,
      });
      renderer.render(WITH_SLIDE);
      await Promise.resolve();
      const image = parent.querySelector<HTMLImageElement>('img[src]');
      if (image === null) throw new Error('expected a still background');
      image.dispatchEvent(new Event('load'));
      const background = parent.querySelector<HTMLElement>(
        '[data-layer="background"]',
      );
      const lyrics = parent.querySelector<HTMLElement>('[data-layer="lyrics"]');
      expect(image.classList.contains(classes.shown)).toBe(true);
      expect(Number(background?.style.zIndex)).toBeLessThan(
        Number(lyrics?.style.zIndex),
      );
      expect(lyrics?.textContent).toContain('만복의 근원');
      expect(onError).not.toHaveBeenCalled();

      renderer.render({...WITH_SLIDE, media: null});
      expect(image.classList.contains(classes.shown)).toBe(false);
      expect(image.hasAttribute('src')).toBe(false);
      renderer.dispose();
    },
  );

  it('keeps the playing video under the lyrics in separate stacking contexts', () => {
    const {parent, renderer} = setUp();
    renderer.render(WITH_SLIDE, {transitions: true});
    parent.querySelector('video[src]')?.dispatchEvent(new Event('playing'));
    const box = (name: string): HTMLElement | null =>
      parent.querySelector<HTMLElement>(`[data-layer="${name}"]`);
    const background = box('background');
    const lyrics = box('lyrics');
    expect(Number(background?.style.zIndex)).toBeLessThan(
      Number(lyrics?.style.zIndex),
    );
    expect(
      background?.querySelector('video[src]')?.getAttribute('style'),
    ).toContain('z-index: 1');
    expect(lyrics?.querySelector('video')).toBeNull();
  });

  it('reflects a clear in the same call', () => {
    const {parent, renderer} = setUp();
    renderer.render(WITH_SLIDE);
    renderer.render({...WITH_SLIDE, slide: null});
    expect(
      parent.querySelector(`.${classes.page}.${classes.shown}`),
    ).toBeNull();
  });

  it('lays the lyrics out again when the screen size changes', () => {
    const rescale = vi.spyOn(SlideLayerView.prototype, 'rescale');
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(960);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(540);
    setUp();
    MockResizeObserver.instances[0]?.callback();
    expect(rescale).toHaveBeenLastCalledWith(0.5);
  });

  it('sets the screen correction on the root once, and only for a new screen or size', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(960);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(540);
    const {parent, renderer} = setUp();
    const root = parent.querySelector<HTMLElement>(`.${classes.root}`);
    if (root === null) throw new Error('Missing root');
    const setProperty = vi.spyOn(root.style, 'setProperty');
    let reads = 0;
    const correction = {
      get edgeMargin(): number {
        reads += 1;
        return 10;
      },
      offset: {x: 40, y: 20},
    };
    const frame = {screen: {id: MAIN, kind: 'audience', correction}} as const;
    renderer.render(WITH_SLIDE, frame);
    expect(root.style.getPropertyValue('--picture-transform')).toBe(
      'translate(20px, 10px) scale(0.8)',
    );
    renderer.render(WITH_SLIDE, frame);
    expect(reads).toBe(1);
    renderer.render(WITH_SLIDE, {
      screen: {
        ...frame.screen,
        correction: {edgeMargin: 10, offset: {x: 40, y: 20}},
      },
    });
    expect(
      setProperty.mock.calls.filter(([name]) => name === '--picture-transform'),
    ).toHaveLength(1);
    renderer.render(WITH_SLIDE, {screen: {id: MAIN, kind: 'audience'}});
    expect(root.style.getPropertyValue('--picture-transform')).toBe('');
  });

  it('moves the picture by the same share of its size at any drawn size', () => {
    const size = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get');
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get');
    size.mockReturnValue(1920);
    height.mockReturnValue(1080);
    const {parent, renderer} = setUp();
    const root = parent.querySelector<HTMLElement>(`.${classes.root}`);
    const correction = {edgeMargin: 0, offset: {x: 40, y: -20}};
    renderer.render(WITH_SLIDE, {
      screen: {id: MAIN, kind: 'audience', correction},
    });
    const transformAt = (width: number, tall: number) => {
      size.mockReturnValue(width);
      height.mockReturnValue(tall);
      MockResizeObserver.instances[0]?.callback();
      return root?.style.getPropertyValue('--picture-transform');
    };
    expect(transformAt(1920, 1080)).toBe('translate(40px, -20px) scale(1)');
    // NOTE(0913vision): A 4K monitor and a quarter-size preview move the
    // picture by the same share of their width.
    expect(transformAt(3840, 2160)).toBe('translate(80px, -40px) scale(1)');
    expect(transformAt(480, 270)).toBe('translate(10px, -5px) scale(1)');
    renderer.dispose();
  });

  it('draws a cached still without video elements in preview mode', () => {
    const parent = document.createElement('div');
    const renderer = new OutputRenderer(parent, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl: mediaId => `https://media.test/${mediaId}.jpg`,
      onError: vi.fn(),
      mode: 'preview',
    });
    renderer.render(WITH_SLIDE);
    expect(parent.querySelector('video')).toBeNull();
    expect(parent.querySelector('img[src]')?.getAttribute('src')).toContain(
      '.jpg',
    );
    renderer.dispose();
  });
});
