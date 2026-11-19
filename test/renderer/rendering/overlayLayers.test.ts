import {builtInTheme, standbyStageLayout} from '@core/themes/defaults';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LiveStore} from '@main/live/store';
import {
  CAPTIONS,
  IMAGE_PROP,
  MAIN,
  overlaySettings,
  PROP,
  STAGE,
  TEXT_STYLE,
  overlayUuid,
} from '@fixtures/core/overlays';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {classes} from '@renderer/rendering/classes';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import type {RenderScreen} from '@renderer/rendering/layer';

const disposers: Array<() => void> = [];
const TEST_FRAME_MS = 16;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback =>
    window.setTimeout(() => callback(performance.now()), TEST_FRAME_MS),
  );
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(handle =>
    window.clearTimeout(handle),
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.useRealTimers();
});

function setup() {
  const settings = overlaySettings();
  const store = new LiveStore(undefined, () => Date.now());
  store.connectSettings(settings.reader);
  const parent = document.createElement('div');
  const onError = vi.fn();
  const renderer = new OutputRenderer(parent, {
    textStyle: DEFAULT_TEXT_STYLE,
    mediaUrl: id => `https://media.test/${id}`,
    onError,
  });
  disposers.push(() => renderer.dispose());
  const send = (value: unknown): void => {
    const command = parseLiveCommand(value);
    if (!command.ok) throw new Error(JSON.stringify(command.error));
    store.dispatch(
      command.value,
      error => {
        throw error;
      },
      problem => {
        throw new Error(JSON.stringify(problem));
      },
    );
  };
  const render = (screen: RenderScreen = {id: MAIN, kind: 'audience'}): void =>
    renderer.render(store.state.layers, {
      screen,
      stageMessage: store.state.stageMessage ?? null,
      testPattern: store.state.testPatterns?.includes(screen.id) === true,
      clearEffects: store.state.clearEffects ?? [],
      timers: {
        list: [],
        runs: undefined,
        now: () => ({timer: Date.now(), wall: Date.now()}),
      },
    });
  const box = (kind: string) =>
    parent.querySelector<HTMLElement>(`[data-layer="${kind}"]`);
  const shownText = (kind: string) =>
    kind === 'stage-message'
      ? (box(kind)?.querySelector('[data-stage-message-band]:not([hidden])')
          ?.textContent ?? null)
      : (box(kind)?.querySelector(`.${classes.shown}`)?.textContent ?? null);
  return {
    settings,
    store,
    parent,
    renderer,
    send,
    render,
    box,
    shownText,
    onError,
  };
}

describe('registered overlay layers', () => {
  it.each(['pattern first', 'message first'])(
    'draws the stage message over the pattern: %s',
    order => {
      const {send, render, box, shownText, store} = setup();
      const pattern = () =>
        send({type: 'screen.testPattern.set', screenId: STAGE, on: true});
      const message = () =>
        send({type: 'stage.message.set', text: 'Stage cue'});
      if (order === 'pattern first') {
        pattern();
        render({id: STAGE, kind: 'stage'});
        message();
      } else {
        message();
        render({id: STAGE, kind: 'stage'});
        pattern();
      }
      render({id: STAGE, kind: 'stage'});
      expect(store.state.testPatterns).toContain(STAGE);
      expect(shownText('stage-message')).toBe('Stage cue');
      expect(
        box('test-pattern')?.firstElementChild?.hasAttribute('hidden'),
      ).toBe(false);
      expect(Number(box('stage-message')?.style.zIndex)).toBeGreaterThan(
        Number(box('test-pattern')?.style.zIndex),
      );
    },
  );

  it('shows a stage message immediately on a fresh output', () => {
    const {send, render, box, shownText} = setup();
    render({id: STAGE, kind: 'stage'});
    send({type: 'stage.message.set', text: 'First message'});
    render({id: STAGE, kind: 'stage'});
    expect(shownText('stage-message')).toBe('First message');
    expect(box('stage-message')?.style.opacity).not.toBe('0');
  });
  it.each([
    [1200, 200],
    [200, 1200],
  ])(
    'keeps consecutive prop fades ordered with durations %i and %i',
    (firstDuration, secondDuration) => {
      const {settings, send, render, box} = setup();
      const existing = settings.reader.get('props');
      if (existing.name !== 'props') throw new Error('Missing prop fixture');
      settings.update(
        settingsDocument('props', {
          props: [
            ...existing.value.props,
            {
              id: overlayUuid(12),
              name: 'Remaining',
              targets: [MAIN],
              content: {kind: 'text', text: 'Remaining', style: TEXT_STYLE},
            },
          ],
        }),
      );
      send({type: 'prop.set', propId: PROP, on: true});
      send({type: 'prop.set', propId: IMAGE_PROP, on: true});
      send({type: 'prop.set', propId: overlayUuid(12), on: true});
      render();
      const boxes = Array.from(box('prop')?.children ?? []).filter(
        (value): value is HTMLElement => value instanceof HTMLElement,
      );
      send({
        type: 'overlay.clear',
        target: {kind: 'prop', propId: PROP},
        transition: {fade: true, durationMs: firstDuration},
      });
      render();
      send({
        type: 'overlay.clear',
        target: {kind: 'prop', propId: IMAGE_PROP},
        transition: {fade: true, durationMs: secondDuration},
      });
      render();
      vi.advanceTimersByTime(100);
      const host = box('prop');
      expect(host instanceof HTMLElement ? host.style.opacity : null).toBe('');
      expect(boxes.map(value => value.style.zIndex)).toEqual(['0', '1', '2']);
      expect(Number(boxes[0]?.style.opacity)).toBeCloseTo(
        1 - 100 / firstDuration,
        1,
      );
      expect(Number(boxes[1]?.style.opacity)).toBeCloseTo(
        1 - 100 / secondDuration,
        1,
      );
      vi.advanceTimersByTime(200);
      expect(boxes[0]?.hidden).toBe(firstDuration < secondDuration);
      expect(boxes[1]?.hidden).toBe(secondDuration < firstDuration);
      const remaining = boxes.filter(value => !value.hidden);
      expect(remaining.map(value => value.style.zIndex)).toEqual(['0', '1']);
      expect(remaining[0]).toBe(
        firstDuration < secondDuration ? boxes[1] : boxes[0],
      );
      expect(remaining[1]).toBe(boxes[2]);
      vi.advanceTimersByTime(1000);
      expect(boxes.slice(0, 2).every(value => value.hidden)).toBe(true);
      expect(boxes[2]?.hidden).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('shows all 64 newly live props when an outgoing fade competes for the pool', () => {
    const {settings, send, render, box} = setup();
    const props = Array.from({length: 65}, (_, index) => ({
      id: overlayUuid(1000 + index),
      name: `Prop ${index}`,
      targets: [MAIN],
      content: {kind: 'text', text: `Prop ${index}`, style: TEXT_STYLE},
    }));
    settings.update(settingsDocument('props', {props}));
    for (const prop of props.slice(0, 64)) {
      send({type: 'prop.set', propId: prop.id, on: true});
    }
    render();
    send({
      type: 'overlay.clear',
      target: {kind: 'prop', propId: overlayUuid(1000)},
      transition: {fade: true, durationMs: 5000},
    });
    render();
    const request = vi.spyOn(globalThis, 'requestAnimationFrame');
    request.mockClear();
    send({type: 'prop.set', propId: overlayUuid(1064), on: true});
    render();
    const shown = Array.from(box('prop')?.children ?? []).filter(
      value => value instanceof HTMLElement && !value.hidden,
    );
    expect(shown).toHaveLength(64);
    expect(shown.some(value => value.textContent.includes('Prop 64'))).toBe(
      true,
    );
    expect(box('prop')?.children).toHaveLength(64);
    expect(request).not.toHaveBeenCalled();
  });
  it('fades a removed prop in its original order while its neighbor stays fully shown', () => {
    const {send, render, box} = setup();
    send({type: 'prop.set', propId: PROP, on: true});
    send({type: 'prop.set', propId: IMAGE_PROP, on: true});
    render();
    send({
      type: 'overlay.clear',
      target: {kind: 'prop', propId: PROP},
      transition: {fade: true, durationMs: 1000},
    });
    render();
    vi.advanceTimersByTime(500);
    const boxes = Array.from(box('prop')?.children ?? []);
    expect(boxes).toHaveLength(2);
    const opacity = boxes.map(child =>
      child instanceof HTMLElement ? Number(child.style.opacity || 1) : 0,
    );
    expect(opacity[0]).toBeCloseTo(0.5, 1);
    expect(opacity[1]).toBe(1);
    send({type: 'clear.undo'});
    render();
    expect(
      boxes.map(child =>
        child instanceof HTMLElement ? child.style.opacity : '',
      ),
    ).toEqual(['', '']);
  });

  it('draws the target message only and clears every reusable page at once', () => {
    const {store, send, render, renderer, box, shownText} = setup();
    send({
      type: 'message.send',
      text: 'Audience',
      targets: [MAIN],
      duration: 30,
    });
    send({
      type: 'message.send',
      text: 'Captions',
      targets: [CAPTIONS],
      duration: null,
    });
    render();
    expect(shownText('message')).toBe('Audience');
    const pages = [
      ...(box('message')?.querySelectorAll(`.${classes.page}`) ?? []),
    ];
    render({id: CAPTIONS, kind: 'audience'});
    expect(shownText('message')).toBe('Captions');
    render({id: STAGE, kind: 'stage'});
    expect(shownText('message')).toBeNull();
    renderer.render(store.state.layers);
    expect(shownText('message')).toBeNull();
    send({type: 'layer.clear', target: 'message'});
    render();
    expect(shownText('message')).toBeNull();
    expect([
      ...(box('message')?.querySelectorAll(`.${classes.page}`) ?? []),
    ]).toEqual(pages);
  });

  it('keeps the stage message above overlays, only on a stage screen, through all clears', () => {
    const {send, render, box, shownText} = setup();
    send({type: 'stage.message.set', text: 'Stage cue'});
    render();
    expect(shownText('stage-message')).toBeNull();
    render({id: STAGE, kind: 'stage'});
    expect(shownText('stage-message')).toBe('Stage cue');
    send({type: 'layer.clear', target: 'all'});
    render({id: STAGE, kind: 'stage'});
    expect(shownText('stage-message')).toBe('Stage cue');
    expect(
      Number(
        box('stage-message')
          ?.getAttribute('style')
          ?.match(/z-index: (\d+)/)?.[1],
      ),
    ).toBeGreaterThan(5);
    send({type: 'stage.message.set', text: null});
    render({id: STAGE, kind: 'stage'});
    expect(shownText('stage-message')).toBeNull();
  });

  it('draws a stage message above themed and saved layouts', () => {
    const {send, renderer, store, parent} = setup();
    send({type: 'stage.message.set', text: 'Stage cue'});
    const theme = builtInTheme('song');
    const layout = theme.screens[STAGE];
    if (layout === undefined) throw Error('Missing stage layout');
    const themeFrame = {
      themeId: theme.id,
      revision: 1,
      missing: [],
      sourceScreenId: STAGE,
      emptyColor: '#000000',
      layout,
      item: null,
    };
    const stageFrame = {
      screen: {id: STAGE, kind: 'stage' as const},
      stageMessage: 'Stage cue',
      transitions: false,
    };
    renderer.render(store.state.layers, {...stageFrame, theme: themeFrame});
    expect(parent.querySelector('[data-stage-message-band]')?.textContent).toBe(
      'Stage cue',
    );
    expect(parent.querySelector('[data-kind="stageMessage"]')).toBeNull();
    const savedLayout = {
      ...layout,
      elements: layout.elements.filter(
        element => element.kind !== 'stageMessage',
      ),
    };
    renderer.render(store.state.layers, {
      ...stageFrame,
      theme: {...themeFrame, layout: savedLayout},
    });
    expect(parent.querySelector('[data-stage-message-band]')?.textContent).toBe(
      'Stage cue',
    );
    renderer.render(store.state.layers, {
      ...stageFrame,
      screen: {id: MAIN, kind: 'audience'},
      theme: {...themeFrame, layout: savedLayout},
    });
    expect(parent.querySelector('[data-stage-message-band]')?.textContent).toBe(
      '',
    );
  });

  it('bounds a long stage cue to three lines with an ellipsis', () => {
    const width = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(1920);
    const height = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockReturnValue(1080);
    const {send, render, parent} = setup();
    width.mockRestore();
    height.mockRestore();
    const message = 'a'.repeat(4000);
    send({type: 'stage.message.set', text: message});
    render({id: STAGE, kind: 'stage'});
    const band = parent.querySelector<HTMLElement>('[data-stage-message-band]');
    expect(band?.textContent).toBe(message);
    expect(band?.hidden).toBe(false);
    expect(band?.style.display).toBe('-webkit-box');
    expect(band?.style.getPropertyValue('-webkit-line-clamp')).toBe('3');
    expect(band?.style.overflow).toBe('hidden');
    expect(parseFloat(band?.style.maxHeight ?? '')).toBeGreaterThan(0);
  });

  it('places a two-line stage cue above the standby composition', () => {
    const {renderer, store, parent} = setup();
    const theme = builtInTheme('song');
    const message = 'First line\nSecond line';
    renderer.render(store.state.layers, {
      screen: {id: STAGE, kind: 'stage'},
      stageMessage: message,
      standby: true,
      transitions: false,
      theme: {
        themeId: theme.id,
        revision: 1,
        missing: [],
        sourceScreenId: STAGE,
        emptyColor: '#000000',
        layout: standbyStageLayout(),
        item: null,
      },
    });
    const band = parent.querySelector<HTMLElement>('[data-stage-message-band]');
    const stageLayer = parent.querySelector<HTMLElement>(
      '[data-layer="stage-message"]',
    );
    const themeLayer = parent.querySelector<HTMLElement>(
      '[data-layer="theme"]',
    );
    expect(band?.textContent).toBe(message);
    expect(band?.hidden).toBe(false);
    expect(band?.style.display).toBe('-webkit-box');
    expect(band?.style.bottom).toBe('0px');
    expect(band?.style.width).toBe('100%');
    expect(themeLayer?.hidden).toBe(false);
    expect(themeLayer?.querySelector('[data-kind="clock"]')).not.toBeNull();
    expect(Number(stageLayer?.style.zIndex)).toBeGreaterThan(
      Number(themeLayer?.style.zIndex),
    );
  });

  it('routes several image and text props and reuses their elements across clears', () => {
    const {send, render, box, shownText} = setup();
    send({type: 'prop.set', propId: PROP, on: true});
    send({type: 'prop.set', propId: IMAGE_PROP, on: true});
    render();
    expect(shownText('prop')).toBe('Fixture prop');
    expect(box('prop')?.querySelectorAll('img')).toHaveLength(4);
    send({type: 'layer.clear', target: 'prop'});
    render();
    send({type: 'clear.undo'});
    render();
    const elements = [...(box('prop')?.querySelectorAll('*') ?? [])];
    for (let change = 0; change < 100; change += 1) {
      send({type: 'layer.clear', target: 'prop'});
      render();
      expect(shownText('prop')).toBeNull();
      send({type: 'clear.undo'});
      render();
    }
    expect([...(box('prop')?.querySelectorAll('*') ?? [])]).toEqual(elements);
    render({id: CAPTIONS, kind: 'audience'});
    expect(shownText('prop')).toBeNull();
    expect(box('prop')?.querySelectorAll('img[src]')).toHaveLength(1);
    render({id: STAGE, kind: 'stage'});
    expect(box('prop')?.querySelectorAll('img[src]')).toHaveLength(0);
  });
});
