import {describe, expect, it} from 'vitest';
import {
  addGradientStop,
  createGradient,
  moveGradientStop,
  removeGradientStop,
  type GradientBackground,
} from '@core/theme';
import {THEME_FILE_LIMITS} from '@core/schema/screens/theme';

function gradient(...positions: number[]): GradientBackground {
  return {
    kind: 'gradient',
    angle: 90,
    stops: positions.map((position, index) => ({
      color: `#00000${index}`,
      position,
    })),
  };
}

describe('createGradient', () => {
  it('starts from the color to white at 135 degrees', () => {
    expect(createGradient('#123456')).toEqual({
      kind: 'gradient',
      angle: 135,
      stops: [
        {color: '#123456', position: 0},
        {color: '#FFFFFF', position: 100},
      ],
    });
  });
});

describe('addGradientStop', () => {
  it('puts the new stop in order and says where', () => {
    const {gradient: next, index} = addGradientStop(
      gradient(0, 100),
      40,
      '#FF0000',
    );

    expect(index).toBe(1);
    expect(next.stops.map(stop => stop.position)).toEqual([0, 40, 100]);
    expect(next.stops[1]?.color).toBe('#FF0000');
  });

  it('adds after a stop at the same place, keeping a hard edge', () => {
    const {index} = addGradientStop(gradient(0, 50, 100), 50, '#FF0000');

    expect(index).toBe(2);
  });

  it('keeps the position between 0 and 100', () => {
    const before = addGradientStop(gradient(0, 100), -20, '#FF0000');
    const after = addGradientStop(gradient(0, 100), 140, '#FF0000');

    expect(before.gradient.stops[0]?.position).toBe(0);
    expect(after.gradient.stops.at(-1)?.position).toBe(100);
  });

  it('adds nothing at the stop limit', () => {
    const full = gradient(
      ...Array.from(
        {length: THEME_FILE_LIMITS.gradientStops},
        (_, index) => index * 10,
      ),
    );

    expect(addGradientStop(full, 55, '#FF0000').gradient).toBe(full);
  });
});

describe('moveGradientStop', () => {
  it('moves a stop past its neighbor and follows it to its new place', () => {
    const start = gradient(0, 30, 60, 100);
    const moved = start.stops[1];

    const {gradient: next, index} = moveGradientStop(start, 1, 80);

    expect(next.stops.map(stop => stop.position)).toEqual([0, 60, 80, 100]);
    expect(index).toBe(2);
    expect(next.stops[index]?.color).toBe(moved?.color);
  });

  it('stays on its own side when moved onto a neighbor, and stops at 100', () => {
    const {gradient: next, index} = moveGradientStop(
      gradient(0, 30, 100),
      1,
      120,
    );

    expect(next.stops.map(stop => stop.position)).toEqual([0, 100, 100]);
    expect(index).toBe(1);
  });

  it('changes nothing for a missing stop or the same place', () => {
    const start = gradient(0, 30, 100);

    expect(moveGradientStop(start, 7, 50).gradient).toBe(start);
    expect(moveGradientStop(start, 1, 30).gradient).toBe(start);
  });
});

describe('removeGradientStop', () => {
  it('removes a stop but always keeps two colors', () => {
    expect(
      removeGradientStop(gradient(0, 50, 100), 1).stops.map(
        stop => stop.position,
      ),
    ).toEqual([0, 100]);
    const two = gradient(0, 100);
    expect(removeGradientStop(two, 0)).toBe(two);
  });

  it('changes nothing for a missing stop', () => {
    const start = gradient(0, 50, 100);

    expect(removeGradientStop(start, 9)).toBe(start);
  });
});
