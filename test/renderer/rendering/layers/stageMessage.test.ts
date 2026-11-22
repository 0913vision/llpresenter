import {beforeEach, expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/schema/live';
import {stageInfoLayer} from '@renderer/rendering/layers/stageInfo';
import {stageMessageLayer} from '@renderer/rendering/layers/stageMessage';
import {THEME_MAIN, THEME_STAGE} from '@fixtures/core/themeOutput';

const frame = (kind: 'stage' | 'audience', stageMessage?: string) => ({
  screen: {id: kind === 'stage' ? THEME_STAGE : THEME_MAIN, name: 'S', kind},
  item: null,
  ...(stageMessage === undefined ? {} : {stageMessage}),
});

let width = 100;
const cancel = vi.fn();
const animate = vi.fn(
  (frames: Keyframe[], timing: KeyframeAnimationOptions) => ({
    cancel,
    frames,
    timing,
  }),
);

beforeEach(() => {
  width = 100;
  cancel.mockClear();
  animate.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: animate,
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(
    () => width,
  );
});

function message() {
  const parent = document.createElement('div');
  const view = stageMessageLayer.create(parent, {
    mediaUrl: String,
    onError: vi.fn(),
  });
  view.rescale?.(1);
  const band = parent.querySelector<HTMLElement>('[data-stage-message-band]');
  if (band === null) throw new Error('No band');
  return {view, band, parent};
}

it('shows the message in one row on 무대 only', () => {
  const {view, band} = message();
  view.render(emptyLayers(), frame('stage', '마이크 확인\n부탁드립니다'));
  expect(band.hidden).toBe(false);
  expect(band.querySelector('span')?.textContent).toBe(
    '마이크 확인   부탁드립니다',
  );
  expect(animate).not.toHaveBeenCalled();
  view.render(emptyLayers(), frame('audience', '마이크 확인'));
  expect(band.hidden).toBe(true);
});

it('flows a message that is longer than the band, and stops with it', () => {
  width = 2000;
  const {view, band} = message();
  view.render(emptyLayers(), frame('stage', '긴 안내'));
  expect(animate).toHaveBeenCalledOnce();
  const [frames, timing] = animate.mock.calls[0] ?? [];
  expect(frames?.at(-1)?.['transform']).toBe('translateX(-2240px)');
  expect(timing?.iterations).toBe(Infinity);
  expect(band.querySelectorAll('span')).toHaveLength(2);
  view.render(emptyLayers(), frame('stage', '긴 안내'));
  expect(animate).toHaveBeenCalledOnce();
  view.render(emptyLayers(), frame('stage'));
  expect(cancel).toHaveBeenCalled();
  expect(band.hidden).toBe(true);
});

it('leaves the page when it is disposed', () => {
  const {view, parent} = message();
  view.dispose();
  expect(parent.childElementCount).toBe(0);
});

it('shows the clock of 무대, and a timer only when one is chosen', () => {
  vi.useFakeTimers({now: new Date(2026, 10, 1, 11, 0, 5)});
  const parent = document.createElement('div');
  const view = stageInfoLayer.create(parent, {
    mediaUrl: String,
    onError: vi.fn(),
  });
  const [clock, timer] = [...parent.children];
  if (!(clock instanceof HTMLElement) || !(timer instanceof HTMLElement)) {
    throw new Error('No clock');
  }
  view.render(emptyLayers(), frame('audience'));
  expect(clock.hidden).toBe(true);
  view.render(emptyLayers(), frame('stage'));
  expect(clock.hidden).toBe(false);
  expect(clock.textContent).toBe('11:00:05');
  expect(timer.hidden).toBe(true);
  vi.advanceTimersByTime(1000);
  expect(clock.textContent).toBe('11:00:06');
  view.dispose();
  expect(parent.childElementCount).toBe(0);
  vi.useRealTimers();
});
