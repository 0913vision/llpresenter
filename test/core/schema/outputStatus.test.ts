import {describe, expect, it} from 'vitest';
import {
  MONITOR_NUMBER_MAX,
  parseOutputRetryRequest,
  parseOutputShowWindowRequest,
  parseOutputStatuses,
} from '@core/schema/outputStatus';
import {MAIN_SCREEN, STAGE_SCREEN} from '@fixtures/core/screenIds';

function statuses() {
  return {
    main: {
      placement: 'fullscreen',
      renderer: 'running',
      fps: 59.8,
      fpsLow: false,
    },
    stage: {placement: 'off', renderer: 'running', fps: null, fpsLow: false},
    broadcast: {
      placement: 'monitorMissing',
      renderer: 'limited',
      fps: 12,
      fpsLow: true,
    },
  };
}

describe('parseOutputStatuses', () => {
  it('accepts optional availability independently of an off output', () => {
    const value = {stage: {...statuses().stage, monitorAvailable: true}};
    expect(parseOutputStatuses(value)).toEqual({ok: true, value});
    expect(
      parseOutputStatuses({stage: {...value.stage, monitorAvailable: 'yes'}})
        .ok,
    ).toBe(false);
  });
  it('accepts the optional control-conflict flag', () => {
    for (const controlConflict of [false, true]) {
      const value = {
        main: {...statuses().main, placement: 'window', controlConflict},
      };
      expect(parseOutputStatuses(value)).toEqual({ok: true, value});
    }
  });
  it('accepts the status of every screen, and no screens', () => {
    expect(parseOutputStatuses(statuses())).toEqual({
      ok: true,
      value: statuses(),
    });
    expect(parseOutputStatuses({})).toEqual({ok: true, value: {}});
  });

  it.each([
    ['an unknown placement', {placement: 'hidden'}, 'main.placement'],
    [
      'a nonboolean conflict flag',
      {controlConflict: 'yes'},
      'main.controlConflict',
    ],
    ['an unknown renderer state', {renderer: 'crashed'}, 'main.renderer'],
    ['a frame rate above the limit', {fps: 241}, 'main.fps'],
    ['a negative frame rate', {fps: -1}, 'main.fps'],
    ['a frame rate that is not finite', {fps: Infinity}, 'main.fps'],
    ['a low flag that is text', {fpsLow: 'yes'}, 'main.fpsLow'],
    ['monitor number 0', {monitor: 0}, 'main.monitor'],
    ['a fractional monitor number', {monitor: 1.5}, 'main.monitor'],
    [
      'a monitor number above the limit',
      {monitor: MONITOR_NUMBER_MAX + 1},
      'main.monitor',
    ],
    ['a monitor number that is text', {monitor: '3'}, 'main.monitor'],
  ])('rejects %s', (_name, change, field) => {
    const value = {...statuses(), main: {...statuses().main, ...change}};

    const parsed = parseOutputStatuses(value);

    expect(parsed.ok ? null : parsed.error.field).toBe(field);
  });

  it('accepts a monitor number from 1 to the limit', () => {
    for (const monitor of [1, 3, MONITOR_NUMBER_MAX]) {
      const value = {...statuses(), main: {...statuses().main, monitor}};
      expect(parseOutputStatuses(value)).toEqual({ok: true, value});
    }
  });

  it('rejects values that are not a record of screens', () => {
    for (const value of [null, [], 'main', {'': statuses().main}]) {
      expect(parseOutputStatuses(value).ok).toBe(false);
    }
  });
});

describe('parseOutputRetryRequest', () => {
  it('accepts a screen id and drops other fields', () => {
    expect(parseOutputRetryRequest({screenId: MAIN_SCREEN, extra: 1})).toEqual({
      ok: true,
      value: {screenId: MAIN_SCREEN},
    });
  });

  it('rejects a missing or empty screen id', () => {
    for (const value of [{}, {screenId: ''}, {screenId: 3}, ['main']]) {
      expect(parseOutputRetryRequest(value).ok).toBe(false);
    }
  });
});

describe('parseOutputShowWindowRequest', () => {
  it('accepts a screen id and drops other fields', () => {
    expect(
      parseOutputShowWindowRequest({screenId: STAGE_SCREEN, x: 1}),
    ).toEqual({
      ok: true,
      value: {screenId: STAGE_SCREEN},
    });
  });

  it('rejects a missing or empty screen id', () => {
    for (const value of [null, {}, {screenId: ''}, {screenId: 3}]) {
      expect(parseOutputShowWindowRequest(value).ok).toBe(false);
    }
  });
});
