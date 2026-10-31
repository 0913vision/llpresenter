import {describe, expect, it} from 'vitest';
import {emptyLiveState, type LiveState} from '../live/state';
import {LIVE_STATE_LIMITS} from './liveLimits';
import {parseLiveState} from './liveState';

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
        label: '후렴',
        lines: ['저 천사여 찬송하세', '찬송 성부 성자 성령'],
      },
      prop: {propId: 'logo'},
      audio: {mediaId: 'prelude'},
      message: {messageId: 'car', text: '12가 3456 차량 이동 부탁드립니다'},
      notice: {noticeId: 'sunday'},
    },
    outputs: {main: true, stage: false},
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
  it('preserves a bounded Bible reference independently of the slide label', () => {
    const state = busyState();
    const slide = state.layers.slide;
    if (slide === null) throw new Error('Missing slide fixture');
    const withReference = {
      ...state,
      layers: {...state.layers, slide: {...slide, reference: '3:16'}},
    };
    expect(parseLiveState(withReference)).toEqual({
      ok: true,
      value: withReference,
    });
    const invalid = {
      ...withReference,
      layers: {
        ...withReference.layers,
        slide: {
          ...slide,
          reference: 'x'.repeat(LIVE_STATE_LIMITS.textCharacters + 1),
        },
      },
    };
    expect(parseLiveState(invalid).ok).toBe(false);
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
  it.each([null, '00000000-0000-4000-8000-000000000004'])(
    'preserves an optional current Look %s',
    lookId => {
      const state = {...emptyLiveState(), lookId};
      expect(parseLiveState(state)).toEqual({ok: true, value: state});
    },
  );

  it.each([
    undefined,
    '',
    'main',
    'a'.repeat(37),
    '00000000-0000-4000-8000-000000000004\n',
    '00000000-0000-1000-8000-000000000004',
    ['00000000-0000-4000-8000-000000000004'],
  ])('rejects an invalid current Look %j', lookId => {
    const result = parseLiveState({...emptyLiveState(), lookId});
    expect(result.ok ? undefined : result.error.field).toBe('lookId');
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
    ['outputs that are not booleans', {outputs: {main: 'on'}}, 'outputs.main'],
    ['no undo flag', {canUndo: undefined}, 'canUndo'],
    ['an undo flag that is text', {canUndo: 'yes'}, 'canUndo'],
  ])('rejects %s', (_name, change, field) => {
    const result = parseLiveState({...busyState(), ...change});

    expect(result.ok ? undefined : result.error.field).toBe(field);
  });

  it.each([
    [
      'a slide with lines that are not text',
      {slide: {itemId: 'i', position: 0, label: null, lines: [1]}},
      'layers.slide.lines.0',
    ],
    [
      'a next slide without lines',
      {
        slide: {
          itemId: 'i',
          position: 0,
          label: null,
          lines: [],
          next: {label: null},
        },
      },
      'layers.slide.next.lines',
    ],
    [
      'a next slide past the line cap',
      {
        slide: {
          itemId: 'i',
          position: 0,
          label: null,
          lines: [],
          next: {
            label: null,
            lines: Array.from(
              {length: LIVE_STATE_LIMITS.slideLines + 1},
              () => 'line',
            ),
          },
        },
      },
      'layers.slide.next.lines',
    ],
    [
      'a next slide with a label past the text cap',
      {
        slide: {
          itemId: 'i',
          position: 0,
          label: null,
          lines: [],
          next: {
            label: 'a'.repeat(LIVE_STATE_LIMITS.textCharacters + 1),
            lines: [],
          },
        },
      },
      'layers.slide.next.label',
    ],
    [
      'a slide at a fractional position',
      {slide: {itemId: 'i', position: 0.5, label: null, lines: []}},
      'layers.slide.position',
    ],
    [
      'media without an id',
      {media: {mediaId: '', loop: true}},
      'layers.media.mediaId',
    ],
    [
      'a background without a start time',
      {media: {mediaId: 'm', loop: true}},
      'layers.media.startedAt',
    ],
    [
      'an infinite start time',
      {media: {mediaId: 'm', loop: true, startedAt: Infinity}},
      'layers.media.startedAt',
    ],
  ])('rejects a layer with %s', (_name, layers, field) => {
    const state = busyState();

    const result = parseLiveState({
      ...state,
      layers: {...state.layers, ...layers},
    });

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

  it('carries the next slide, the stage layout per stage screen, and the stage 타이머', () => {
    const state = {
      ...busyState(),
      layers: {
        ...busyState().layers,
        slide: {
          itemId: 'item-1',
          position: 0,
          label: '1절',
          lines: ['첫 줄'],
          next: {label: null, lines: ['둘째 줄']},
        },
      },
      stageLayouts: {[screenUuid(1)]: screenUuid(5)},
      stageTimerId: screenUuid(6),
    };
    expect(parseLiveState(state)).toEqual({ok: true, value: state});
    const field = (change: object) => {
      const result = parseLiveState({...emptyLiveState(), ...change});
      return result.ok ? undefined : result.error.field;
    };
    expect(field({stageLayouts: {main: screenUuid(5)}})).toBe(
      'stageLayouts.main',
    );
    expect(field({stageLayouts: {[screenUuid(1)]: 'layout'}})).toBe(
      `stageLayouts.${screenUuid(1)}`,
    );
    expect(
      field({
        stageLayouts: Object.fromEntries(
          Array.from({length: LIVE_STATE_LIMITS.outputs + 1}, (_, index) => [
            screenUuid(index + 1),
            screenUuid(5),
          ]),
        ),
      }),
    ).toBe('stageLayouts');
    expect(field({stageTimerId: 'clock'})).toBe('stageTimerId');
    expect(field({stageTimerId: null})).toBe('stageTimerId');
  });

  it('rejects values that are not states', () => {
    for (const value of [null, undefined, [], 'state', 3]) {
      expect(parseLiveState(value).ok).toBe(false);
    }
  });
});
