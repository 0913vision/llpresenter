import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers} from '@shared/live';
import {MAIN} from '../../../main/live/testing/overlays';
import {DEFAULT_LYRIC_STYLE} from './lyricStyle';
import {OutputRenderer} from './outputRenderer';
import {PATTERN_BARS, PATTERN_RAMP_STEPS, TestPatternView} from './testPattern';

const SCREEN = {
  id: MAIN,
  name: '본 화면',
  kind: 'audience',
  method: 'fullscreen',
  pixels: {width: 3840, height: 2160},
} as const;

function setup() {
  const parent = document.createElement('div');
  const view = new TestPatternView(parent);
  const pattern = parent.firstElementChild;
  if (!(pattern instanceof HTMLElement)) throw new Error('Missing pattern');
  const [bars, ramp, label] = [...pattern.children];
  return {parent, view, pattern, bars, ramp, label};
}

beforeEach(() => {
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

  it('names the screen and its own resolution, or the device pixels of a 창', () => {
    const {parent, view, label} = setup();
    view.show(SCREEN, true);
    expect(label?.textContent).toBe('본 화면\n3840×2160');
    vi.spyOn(parent, 'clientWidth', 'get').mockReturnValue(960);
    vi.spyOn(parent, 'clientHeight', 'get').mockReturnValue(540);
    vi.stubGlobal('devicePixelRatio', 1.5);
    const windowed = {id: MAIN, kind: 'audience', method: 'window'} as const;
    view.show(windowed, true);
    expect(label?.textContent).toBe('1440×810');
    vi.spyOn(parent, 'clientWidth', 'get').mockReturnValue(1280);
    vi.spyOn(parent, 'clientHeight', 'get').mockReturnValue(720);
    view.rescale(1);
    expect(label?.textContent).toBe('1920×1080');
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
});
