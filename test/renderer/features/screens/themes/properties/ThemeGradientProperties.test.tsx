import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {GRADIENT_PRESETS, type GradientBackground} from '@core/theme';
import {ThemeGradientProperties} from '@renderer/features/screens/themes/properties/ThemeGradientProperties';

const sampled = vi.hoisted(() => {
  const state: {color: string | null} = {color: '#808080'};
  return state;
});
vi.mock('@renderer/rendering/theme/sampleGradient', () => ({
  sampleGradient: () => sampled.color,
}));

const GRADIENT: GradientBackground = {
  kind: 'gradient',
  angle: 90,
  stops: [
    {color: '#1E2761', position: 0},
    {color: '#F96167', position: 100},
  ],
};

beforeEach(() => {
  sampled.color = '#808080';
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setUp(gradient: GradientBackground = GRADIENT) {
  const change = vi.fn<(next: GradientBackground) => void>();
  const reportError = vi.fn<(error: unknown) => void>();
  render(
    <ThemeGradientProperties
      gradient={gradient}
      model={{reason: undefined, beginEditGroup: () => vi.fn(), reportError}}
      change={change}
    />,
  );
  const bar = screen.getByRole('group', {name: '그라데이션 색상점'});
  const track = bar.firstElementChild;
  if (!(track instanceof HTMLElement)) throw new Error('No track');
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 200, 20),
  );
  return {change, reportError, track};
}

it('puts the angle and colors of a preset, and nothing for the preset shown', () => {
  const [preset] = GRADIENT_PRESETS;
  if (preset === undefined) throw new Error('No preset');
  const {change} = setUp();
  fireEvent.click(screen.getByRole('button', {name: preset.name}));
  expect(change).toHaveBeenCalledWith({
    ...GRADIENT,
    angle: preset.gradient.angle,
    stops: preset.gradient.stops,
  });
  cleanup();
  const shown = setUp({...GRADIENT, ...preset.gradient, kind: 'gradient'});
  fireEvent.click(screen.getByRole('button', {name: preset.name}));
  expect(shown.change).not.toHaveBeenCalled();
});

it('adds a color sampled where the bar is clicked', () => {
  const {track, change} = setUp();
  fireEvent.click(track, {clientX: 50});
  expect(change).toHaveBeenCalledWith({
    ...GRADIENT,
    stops: [
      GRADIENT.stops[0],
      {color: '#808080', position: 25},
      GRADIENT.stops[1],
    ],
  });
});

it('reports a color it can not sample, adding nothing', () => {
  sampled.color = null;
  const {track, change, reportError} = setUp();
  fireEvent.click(track, {clientX: 50});
  expect(change).not.toHaveBeenCalled();
  expect(reportError).toHaveBeenCalledOnce();
});

it('adds no color past the most a gradient holds', () => {
  const full: GradientBackground = {
    ...GRADIENT,
    stops: [0, 20, 40, 60, 80, 100].map(position => ({
      color: '#1E2761',
      position,
    })),
  };
  const {track, change} = setUp(full);
  fireEvent.click(track, {clientX: 50});
  expect(change).not.toHaveBeenCalled();
});

it('deletes the chosen color only while more than two are left', () => {
  const three: GradientBackground = {
    ...GRADIENT,
    stops: [
      GRADIENT.stops[0],
      {color: '#FFFFFF', position: 50},
      GRADIENT.stops[1],
    ].filter(stop => stop !== undefined),
  };
  const {change} = setUp(three);
  fireEvent.click(screen.getAllByRole('slider')[1] ?? document.body);
  fireEvent.click(screen.getByRole('button', {name: '색 삭제'}));
  expect(change).toHaveBeenCalledWith(GRADIENT);
  cleanup();
  setUp();
  expect(
    screen.getByRole('button', {name: '색 삭제'}).getAttribute('aria-disabled'),
  ).toBe('true');
});
