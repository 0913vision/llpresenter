import {beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@shared/live';
import type {RenderMode} from './backgroundLayer';
import {classes} from './classes';
import {DEFAULT_LYRIC_STYLE} from './lyricStyle';
import {OutputRenderer} from './outputRenderer';
import type {ScreenAppearance} from './screenLook';
import {SlideLayerView} from './slideLayer';
import {MAIN} from '../../../main/live/testing/overlays';

class FakeResizeObserver {
  static readonly instances: FakeResizeObserver[] = [];
  observed: Element | null = null;
  disconnected = false;

  constructor(readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
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
  FakeResizeObserver.instances.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});

function setUp() {
  const parent = document.createElement('div');
  const onError = vi.fn();
  const renderer = new OutputRenderer(parent, {
    lyricStyle: DEFAULT_LYRIC_STYLE,
    mediaUrl: mediaId => `https://media.test/${mediaId}.mp4`,
    onError,
  });
  return {parent, renderer, onError};
}

describe('OutputRenderer', () => {
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
    'draws an image under the lyrics and clears it in the same call in %s mode',
    async mode => {
      vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
        new DOMException('The source is an image', 'NotSupportedError'),
      );
      const parent = document.createElement('div');
      const onError = vi.fn();
      const renderer = new OutputRenderer(parent, {
        lyricStyle: DEFAULT_LYRIC_STYLE,
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

  it('draws the background under the lyrics', () => {
    const {parent, renderer} = setUp();
    renderer.render(WITH_SLIDE);
    const root = parent.querySelector(`.${classes.root}`);
    const [background, lyrics] = [...(root?.children ?? [])];
    expect(background?.querySelector('video[src]')?.getAttribute('src')).toBe(
      'https://media.test/warm-light.mp4',
    );
    expect(lyrics?.querySelector(`.${classes.shown}`)?.textContent).toBe(
      '만복의 근원',
    );
  });

  it('reflects a clear in the same call', () => {
    const {parent, renderer} = setUp();
    renderer.render(WITH_SLIDE);
    renderer.render({...WITH_SLIDE, slide: null});
    expect(
      parent.querySelector(`.${classes.page}.${classes.shown}`),
    ).toBeNull();
  });

  it('keeps drawing the other layers when one layer throws', () => {
    vi.spyOn(SlideLayerView.prototype, 'show').mockImplementation(() => {
      throw new Error('layout failed');
    });
    const {parent, renderer, onError} = setUp();
    renderer.render(WITH_SLIDE);
    expect(onError).toHaveBeenCalledWith(
      'could not draw the lyrics layer',
      expect.any(Error),
    );
    expect(parent.querySelector('video[src]')).not.toBeNull();
  });

  it('lays the lyrics out again when the screen size changes', () => {
    const rescale = vi.spyOn(SlideLayerView.prototype, 'rescale');
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(960);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(540);
    setUp();
    FakeResizeObserver.instances[0]?.callback();
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
      FakeResizeObserver.instances[0]?.callback();
      return root?.style.getPropertyValue('--picture-transform');
    };
    expect(transformAt(1920, 1080)).toBe('translate(40px, -20px) scale(1)');
    // NOTE(0913vision): A 4K monitor and a quarter-size preview move the
    // picture by the same share of their width.
    expect(transformAt(3840, 2160)).toBe('translate(80px, -40px) scale(1)');
    expect(transformAt(480, 270)).toBe('translate(10px, -5px) scale(1)');
    renderer.dispose();
  });

  it('stops watching the size and removes everything on dispose', () => {
    const {parent, renderer} = setUp();
    renderer.dispose();
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
    expect(parent.childElementCount).toBe(0);
  });

  it('passes the preview mode to the background', () => {
    const parent = document.createElement('div');
    const renderer = new OutputRenderer(parent, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl: mediaId => `https://media.test/${mediaId}.mp4`,
      onError: vi.fn(),
      mode: 'preview',
    });
    renderer.render(WITH_SLIDE);
    const video = parent.querySelector<HTMLVideoElement>('video[src]');
    expect(video?.loop).toBe(true);
    renderer.dispose();
  });
});

describe('OutputRenderer under a Look', () => {
  const screen = {id: MAIN, kind: 'audience', method: 'fullscreen'} as const;
  const lookWith = (
    layers: ScreenAppearance['layers'],
    fields: Partial<ScreenAppearance> = {},
  ): ScreenAppearance => ({
    layers,
    lyricStyle: DEFAULT_LYRIC_STYLE,
    background: null,
    ...fields,
  });
  const box = (parent: HTMLElement, name: string): HTMLElement | null =>
    parent.querySelector<HTMLElement>(`[data-layer="${name}"]`);
  const hidden = (parent: HTMLElement, name: string): boolean | undefined =>
    box(parent, name)?.classList.contains(classes.hidden);

  it('hides a switched-off layer in place and shows it again without new content', () => {
    const {parent, renderer} = setUp();
    renderer.render(WITH_SLIDE, {screen, look: lookWith({media: true})});
    const page = parent.querySelector(`.${classes.page}.${classes.shown}`);
    const video = parent.querySelector('video[src]');
    expect(hidden(parent, 'lyrics')).toBe(true);
    expect(hidden(parent, 'background')).toBe(false);
    expect(page?.textContent).toContain('만복의 근원');
    renderer.render(WITH_SLIDE, {
      screen,
      look: lookWith({media: true, slide: true}),
    });
    expect(hidden(parent, 'lyrics')).toBe(false);
    expect(parent.querySelector(`.${classes.page}.${classes.shown}`)).toBe(
      page,
    );
    expect(parent.querySelector('video[src]')).toBe(video);
    renderer.dispose();
  });

  it('shows the Look color in place of the media and keeps the video loaded', () => {
    const {parent, renderer} = setUp();
    const captions = {...screen, method: 'capture'} as const;
    renderer.render(WITH_SLIDE, {
      screen: captions,
      look: lookWith({media: true, slide: true}, {background: '#00B140'}),
    });
    const root = parent.querySelector<HTMLElement>(`.${classes.root}`);
    expect(root?.style.getPropertyValue('--output-background')).toBe('#00B140');
    expect(hidden(parent, 'background')).toBe(true);
    expect(parent.querySelector('video[src]')).not.toBeNull();
    renderer.render(WITH_SLIDE, {screen: captions});
    expect(root?.style.getPropertyValue('--output-background')).toBe(
      'var(--chroma)',
    );
    expect(hidden(parent, 'background')).toBe(false);
    renderer.dispose();
  });

  it('draws the lyrics with the Look style and returns to the default', () => {
    const {parent, renderer} = setUp();
    const lowerThird = {...DEFAULT_LYRIC_STYLE, vAlign: 'bottom'} as const;
    const page = (): HTMLElement | null =>
      parent.querySelector<HTMLElement>(
        `[data-layer="lyrics"] .${classes.page}.${classes.shown}`,
      );
    renderer.render(WITH_SLIDE, {
      screen,
      look: lookWith({slide: true}, {lyricStyle: lowerThird}),
    });
    const shown = page();
    expect(shown?.style.justifyContent).toBe('flex-end');
    renderer.render(WITH_SLIDE, {screen});
    expect(page()).toBe(shown);
    expect(shown?.style.justifyContent).toBe('center');
    renderer.dispose();
  });

  it('shows every layer without a Look', () => {
    const {parent, renderer} = setUp();
    renderer.render(WITH_SLIDE, {screen, look: lookWith({})});
    renderer.render(WITH_SLIDE, {screen});
    expect(parent.querySelectorAll(`.${classes.hidden}`)).toHaveLength(0);
    renderer.dispose();
  });
});
