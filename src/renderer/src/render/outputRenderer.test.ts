import {beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@shared/live';
import {classes} from './classes';
import {DEFAULT_LYRIC_STYLE} from './lyricStyle';
import {OutputRenderer} from './outputRenderer';
import {SlideLayerView} from './slideLayer';

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
  it('keeps the playing video under the lyrics in separate stacking contexts', () => {
    const {parent, renderer} = setUp();
    renderer.render(WITH_SLIDE);
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
