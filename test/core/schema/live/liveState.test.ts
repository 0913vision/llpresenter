import {shownText} from '@fixtures/core/liveSlide';
import {describe, expect, it} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/schema/live/live';
import {LIVE_STATE_LIMITS} from '@core/schema/live/liveLimits';
import {parseLiveState} from '@core/schema/live/liveState';
import {MAIN_SCREEN, STAGE_SCREEN} from '@fixtures/core/screenIds';

const screenUuid = (id: number): string =>
  `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`;

function busyState(): LiveState {
  return {
    version: 12,
    layers: {
      media: {mediaId: 'warm-light', loop: true, startedAt: 1_761_300_000_000},
      slide: {
        itemId: 'item-1',
        position: 2,
        ...shownText(['저 천사여 찬송하세', '찬송 성부 성자 성령']),
      },
      prop: {propId: 'logo'},
      audio: {mediaId: 'prelude'},
      message: {messageId: 'car', text: '12가 3456 차량 이동 부탁드립니다'},
    },
    outputs: {[MAIN_SCREEN]: true, [STAGE_SCREEN]: false},
    canUndo: true,
  };
}

describe('parseLiveState', () => {
  it.each([true, false])(
    'accepts an item restore flag of %s',
    canRestoreItem => {
      const state = {...emptyLiveState(), canRestoreItem};
      expect(parseLiveState(state)).toEqual({ok: true, value: state});
    },
  );
  it.each([undefined, null, 1, 'true', []])(
    'rejects malformed item restore flag %j',
    canRestoreItem => {
      expect(parseLiveState({...emptyLiveState(), canRestoreItem}).ok).toBe(
        false,
      );
    },
  );
  it('accepts a bounded last macro ID and rejects malformed IDs', () => {
    const lastMacroId = screenUuid(7);
    expect(parseLiveState({...emptyLiveState(), lastMacroId}).ok).toBe(true);
    expect(
      parseLiveState({...emptyLiveState(), lastMacroId: 'not-an-id'}).ok,
    ).toBe(false);
  });
  it('accepts optional unique clear key restore flags', () => {
    const state = {
      ...emptyLiveState(),
      clearToggles: ['all', 'slide'] as const,
    };
    expect(parseLiveState(state)).toEqual({ok: true, value: state});
  });
  it.each([
    {clearToggles: ['slide', 'slide']},
    {clearToggles: ['unknown']},
    {clearToggles: Array(8).fill('all')},
    {clearToggles: undefined},
    {clearToggles: [null]},
  ])('rejects malformed clear key flags %j', ({clearToggles}) => {
    expect(parseLiveState({...emptyLiveState(), clearToggles}).ok).toBe(false);
  });
  it('accepts an empty state and a state with every layer', () => {
    expect(parseLiveState(emptyLiveState())).toEqual({
      ok: true,
      value: emptyLiveState(),
    });
    expect(parseLiveState(busyState())).toEqual({
      ok: true,
      value: busyState(),
    });
  });

  it.each([
    ['a negative version', {version: -1}, 'version'],
    ['a missing layer', {layers: {media: null}}, 'layers.slide'],
    [
      'outputs that are not booleans',
      {outputs: {[MAIN_SCREEN]: 'on'}},
      `outputs.${MAIN_SCREEN}`,
    ],
    ['no undo flag', {canUndo: undefined}, 'canUndo'],
    ['an undo flag that is text', {canUndo: 'yes'}, 'canUndo'],
  ])('rejects %s', (_name, change, field) => {
    const result = parseLiveState({...busyState(), ...change});

    expect(result.ok ? undefined : result.error.field).toBe(field);
  });

  it('carries the screens that show the 테스트 패턴, each once and within the cap', () => {
    const shown = {
      ...emptyLiveState(),
      testPatterns: [screenUuid(1), screenUuid(2)],
    };
    expect(parseLiveState(shown)).toEqual({ok: true, value: shown});
    const field = (testPatterns: unknown) => {
      const result = parseLiveState({...emptyLiveState(), testPatterns});
      return result.ok ? undefined : result.error.field;
    };
    expect(field([screenUuid(1), screenUuid(1)])).toBe('testPatterns');
    expect(field(['main'])).toBe('testPatterns.0');
    expect(
      field(
        Array.from({length: LIVE_STATE_LIMITS.outputs + 1}, (_, index) =>
          screenUuid(index + 1),
        ),
      ),
    ).toBe('testPatterns');
    expect(
      field(
        Array.from({length: LIVE_STATE_LIMITS.outputs}, (_, index) =>
          screenUuid(index + 1),
        ),
      ),
    ).toBeUndefined();
  });

  it('rejects values that are not states', () => {
    for (const value of [null, undefined, [], 'state', 3]) {
      expect(parseLiveState(value).ok).toBe(false);
    }
  });
});

it('bounds the recorded card sequence length', () => {
  const state = emptyLiveState();
  const slide = {
    itemId: 'item',
    position: 0,
    ...shownText(['Section']),
    sequenceLength: 2,
  };
  expect(parseLiveState({...state, layers: {...state.layers, slide}}).ok).toBe(
    true,
  );
  for (const sequenceLength of [0, 10001, 1.5]) {
    expect(
      parseLiveState({
        ...state,
        layers: {...state.layers, slide: {...slide, sequenceLength}},
      }).ok,
    ).toBe(false);
  }
});
