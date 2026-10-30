import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {MAIN} from '../../../main/live/testing/overlays';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import {OutputRenderer} from './outputRenderer';
import {PATTERN_BARS, PATTERN_RAMP_STEPS, TestPatternView} from './testPattern';

const SCREEN = {
  id: MAIN,
  name: '본 화면',
  kind: 'audience',
  method: 'fullscreen',
} as const;

class FakeMediaQuery {
  static readonly made: FakeMediaQuery[] = [];
  readonly listeners = new Set<() => void>();

  constructor(readonly media: string) {
    FakeMediaQuery.made.push(this);
  }

  addEventListener(_type: 'change', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'change', listener: () => void): void {
    this.listeners.delete(listener);
  }

  change(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

function listening(): readonly string[] {
  return FakeMediaQuery.made
    .filter(query => query.listeners.size > 0)
    .map(({media}) => media);
}

function setup(mode?: 'output' | 'preview') {
  const parent = document.createElement('div');
  const view = new TestPatternView(parent, mode);
  const pattern = parent.firstElementChild;
  if (!(pattern instanceof HTMLElement)) throw new Error('Missing pattern');
  const [bars, ramp, label] = [...pattern.children];
  return {parent, view, pattern, bars, ramp, label};
}

beforeEach(() => {
  FakeMediaQuery.made.length = 0;
  vi.stubGlobal('matchMedia', (media: string) => new FakeMediaQuery(media));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TestPatternView', () => {
  it('draws seven full bars over an 11-step gray ramp, hidden until shown', () => {
    const {view, pattern, bars, ramp} = setup();
    expect(pattern.hidden).toBe(true);
    expect(
      [...(bars?.children ?? [])].map(
        cell => cell instanceof HTMLElement && cell.style.background,
      ),
    ).toEqual([
      'rgb(255, 255, 255)',
      'rgb(255, 255, 0)',
      'rgb(0, 255, 255)',
      'rgb(0, 255, 0)',
      'rgb(255, 0, 255)',
      'rgb(255, 0, 0)',
      'rgb(0, 0, 255)',
    ]);
    expect(PATTERN_BARS).toHaveLength(7);
    const grays = [...(ramp?.children ?? [])].map(
      cell => cell instanceof HTMLElement && cell.style.background,
    );
    expect(grays).toHaveLength(PATTERN_RAMP_STEPS);
    expect([grays[0], grays[5], grays.at(-1)]).toEqual([
      'rgb(0, 0, 0)',
      'rgb(128, 128, 128)',
      'rgb(255, 255, 255)',
    ]);
    view.show(SCREEN, true);
    expect(pattern.hidden).toBe(false);
    view.show(SCREEN, false);
    expect(pattern.hidden).toBe(true);
  });

  it('prints the device pixels the output window covers, and follows a resize', () => {
    const {parent, view, label} = setup();
    vi.spyOn(parent, 'clientWidth', 'get').mockReturnValue(2560);
    vi.spyOn(parent, 'clientHeight', 'get').mockReturnValue(1440);
    vi.stubGlobal('devicePixelRatio', 1.5);
    view.show(SCREEN, true);
    expect(label?.textContent).toBe('본 화면\n3840×2160');
    vi.spyOn(parent, 'clientWidth', 'get').mockReturnValue(960);
    vi.spyOn(parent, 'clientHeight', 'get').mockReturnValue(540);
    view.rescale(0.5);
    expect(label?.textContent).toBe('본 화면\n1440×810');
  });

  it('follows a new Windows scale at the same CSS size, watching only while it shows', () => {
    const {parent, view, label} = setup();
    vi.spyOn(parent, 'clientWidth', 'get').mockReturnValue(1280);
    vi.spyOn(parent, 'clientHeight', 'get').mockReturnValue(720);
    vi.stubGlobal('devicePixelRatio', 1);
    view.show(SCREEN, true);
    view.show(SCREEN, true);
    expect(label?.textContent).toBe('본 화면\n1280×720');
    expect(listening()).toEqual(['(resolution: 1dppx)']);
    expect(FakeMediaQuery.made).toHaveLength(1);
    vi.stubGlobal('devicePixelRatio', 1.5);
    FakeMediaQuery.made.at(-1)?.change();
    expect(label?.textContent).toBe('본 화면\n1920×1080');
    expect(listening()).toEqual(['(resolution: 1.5dppx)']);
    view.show(SCREEN, false);
    expect(listening()).toEqual([]);
    view.show(SCREEN, true);
    expect(listening()).toHaveLength(1);
    view.dispose();
    expect(listening()).toEqual([]);
  });

  it('prints only the name in a preview, and no label without one', () => {
    const {view, label} = setup('preview');
    view.show(SCREEN, true);
    expect(label?.textContent).toBe('본 화면');
    expect(FakeMediaQuery.made).toHaveLength(0);
    view.show({id: MAIN, kind: 'audience'}, true);
    expect(label instanceof HTMLElement && label.hidden).toBe(true);
  });

  it('sizes the label with the screen and relabels only what changed', () => {
    const {view, label} = setup();
    if (!(label instanceof HTMLElement)) throw new Error('Missing label');
    view.rescale(0.5);
    expect(label.style.fontSize).toBe('24px');
    const write = vi.spyOn(label, 'textContent', 'set');
    view.show(SCREEN, true);
    view.show({...SCREEN}, true);
    view.rescale(0.5);
    expect(write).toHaveBeenCalledOnce();
  });

  it('removes itself on dispose', () => {
    const {parent, view} = setup();
    view.dispose();
    expect(parent.childElementCount).toBe(0);
  });
});

describe('the 테스트 패턴 layer', () => {
  it('covers every other layer of the screen the frame marks', () => {
    const parent = document.createElement('div');
    const renderer = new OutputRenderer(parent, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl: id => `https://media.test/${id}`,
      onError: vi.fn(),
    });
    const box = parent.querySelector<HTMLElement>(
      '[data-layer="test-pattern"]',
    );
    const orders = [
      ...parent.querySelectorAll<HTMLElement>('[data-layer]'),
    ].map(({style}) => Number(style.zIndex));
    expect(Number(box?.style.zIndex)).toBe(Math.max(...orders));
    const pattern = box?.firstElementChild;
    renderer.render(emptyLayers(), {screen: SCREEN, testPattern: true});
    expect(pattern instanceof HTMLElement && pattern.hidden).toBe(false);
    renderer.render(emptyLayers(), {screen: SCREEN});
    expect(pattern instanceof HTMLElement && pattern.hidden).toBe(true);
    renderer.dispose();
  });

  it('labels a preview with the name only', () => {
    const parent = document.createElement('div');
    const renderer = new OutputRenderer(parent, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl: id => `https://media.test/${id}`,
      onError: vi.fn(),
      mode: 'preview',
    });
    renderer.render(emptyLayers(), {screen: SCREEN, testPattern: true});
    const label = parent.querySelector('[data-layer="test-pattern"]')
      ?.firstElementChild?.lastElementChild;
    expect(label?.textContent).toBe('본 화면');
    renderer.dispose();
  });
});
