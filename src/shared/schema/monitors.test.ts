import {describe, expect, it} from 'vitest';
import {
  MONITOR_LIST_MAX,
  MONITOR_NAME_MAX,
  MONITOR_REFRESH_RATE_MAX,
  MONITOR_SCALE_FACTOR_MAX,
  parseMonitorList,
} from './monitors';

function monitor(number = 1) {
  return {
    number,
    name: `Monitor ${number}`,
    bounds: {x: (number - 1) * 1920, y: 0, width: 1920, height: 1080},
    scaleFactor: 1.25,
    refreshRate: 59.94,
    hasMainWindow: number === 1,
  };
}

describe('parseMonitorList', () => {
  it('accepts monitors in order, and no monitors', () => {
    const list = [monitor(1), monitor(2)];

    expect(parseMonitorList(list)).toEqual({ok: true, value: list});
    expect(parseMonitorList([])).toEqual({ok: true, value: []});
  });

  it('accepts a monitor left of or above the main one and an unknown rate', () => {
    const value = [
      {
        ...monitor(1),
        bounds: {x: -1920, y: -1080, width: 1920, height: 1080},
        refreshRate: 0,
      },
    ];

    expect(parseMonitorList(value)).toEqual({ok: true, value});
  });

  it('drops unknown fields', () => {
    const parsed = parseMonitorList([{...monitor(), id: 7}]);

    expect(parsed).toEqual({ok: true, value: [monitor()]});
  });

  it.each([
    ['a missing name', {name: undefined}, '0.name'],
    [
      'a name over the limit',
      {name: 'x'.repeat(MONITOR_NAME_MAX + 1)},
      '0.name',
    ],
    ['monitor number 0', {number: 0}, '0.number'],
    ['a fractional monitor number', {number: 1.5}, '0.number'],
    ['a monitor number above the limit', {number: 65}, '0.number'],
    [
      'an empty monitor',
      {bounds: {x: 0, y: 0, width: 0, height: 1080}},
      '0.bounds.width',
    ],
    [
      'fractional bounds',
      {bounds: {x: 0.5, y: 0, width: 1, height: 1}},
      '0.bounds.x',
    ],
    ['a zero scale factor', {scaleFactor: 0}, '0.scaleFactor'],
    [
      'a scale factor above the limit',
      {scaleFactor: MONITOR_SCALE_FACTOR_MAX + 1},
      '0.scaleFactor',
    ],
    ['a negative refresh rate', {refreshRate: -1}, '0.refreshRate'],
    [
      'a refresh rate above the limit',
      {refreshRate: MONITOR_REFRESH_RATE_MAX + 1},
      '0.refreshRate',
    ],
    [
      'a refresh rate that is not finite',
      {refreshRate: Infinity},
      '0.refreshRate',
    ],
    [
      'a main window flag that is text',
      {hasMainWindow: 'yes'},
      '0.hasMainWindow',
    ],
  ])('rejects %s', (_name, change, field) => {
    const parsed = parseMonitorList([{...monitor(), ...change}]);

    expect(parsed.ok ? null : parsed.error.field).toBe(field);
  });

  it('rejects a list over the cap and values that are not lists', () => {
    const over = Array.from({length: MONITOR_LIST_MAX + 1}, () => monitor());

    expect(parseMonitorList(over).ok).toBe(false);
    expect(parseMonitorList({}).ok).toBe(false);
    expect(parseMonitorList(null).ok).toBe(false);
    expect(parseMonitorList(['monitor']).ok).toBe(false);
  });

  it('accepts a list at the cap', () => {
    const full = Array.from({length: MONITOR_LIST_MAX}, (_, i) =>
      monitor(i + 1),
    );

    expect(parseMonitorList(full).ok).toBe(true);
  });
});
