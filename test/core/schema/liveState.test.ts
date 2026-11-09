import {describe, expect, it} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';
import {parseLiveState} from '@core/schema/liveState';
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
        label: '후렴',
        lines: ['저 천사여 찬송하세', '찬송 성부 성자 성령'],
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
  it('preserves bounded title layout on a later live title and rejects invalid positions', () => {
    const state = busyState();
    const titleLayout = {
      titleTracking: 12,
      subtitleTracking: 12,
      subtitleTop: 338,
    };
    const withLayout = (layout: unknown) => ({
      ...state,
      layers: {
        ...state.layers,
        slide: {...state.layers.slide, titleSlide: true, titleLayout: layout},
      },
    });
    const result = parseLiveState(withLayout(titleLayout));
    expect(result).toMatchObject({
      ok: true,
      value: {layers: {slide: {titleLayout}}},
    });
    expect(
      parseLiveState(withLayout({...titleLayout, subtitleTop: 991})).ok,
    ).toBe(false);
  });
  it('accepts a song title marker and rejects other flag values', () => {
    const state = busyState();
    for (const titleSlide of [true, false, 'title', null]) {
      expect(
        parseLiveState({
          ...state,
          layers: {...state.layers, slide: {...state.layers.slide, titleSlide}},
        }).ok,
      ).toBe(titleSlide === true);
    }
  });
  it('preserves bounded measured-part metadata on the next verse', () => {
    const slide = {
      itemId: 'verse',
      position: 0,
      label: null,
      lines: ['First'],
      next: {label: null, lines: ['Next']},
    };
    for (const biblePart of [1, 10_000]) {
      const state = {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          slide: {...slide, next: {...slide.next, biblePart}},
        },
      };
      expect(parseLiveState(state)).toEqual({ok: true, value: state});
    }
    for (const biblePart of [0, -1, 1.5, 10_001, '1']) {
      expect(
        parseLiveState({
          ...emptyLiveState(),
          layers: {
            ...emptyLiveState().layers,
            slide: {...slide, next: {...slide.next, biblePart}},
          },
        }).ok,
      ).toBe(false);
    }
  });
  it('accepts only a bounded positive integer for the optional ad text-slide number', () => {
    const slide = {itemId: 'ad', position: 0, label: null, lines: ['Notice']};
    for (const textSlideNumber of [1, 200]) {
      const state = {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          slide: {...slide, textSlideNumber},
        },
      };
      expect(parseLiveState(state)).toEqual({ok: true, value: state});
    }
    for (const textSlideNumber of [0, -1, 1.5, 201, Infinity, '1']) {
      expect(
        parseLiveState({
          ...emptyLiveState(),
          layers: {
            ...emptyLiveState().layers,
            slide: {...slide, textSlideNumber},
          },
        }).ok,
      ).toBe(false);
    }
  });
  it('preserves picture provenance on media after lyrics are cleared', () => {
    const state = {
      ...emptyLiveState(),
      layers: {
        ...emptyLiveState().layers,
        media: {
          mediaId: 'picture',
          loop: false,
          startedAt: 0,
          slidePicture: true,
        },
      },
    };
    expect(parseLiveState(state)).toEqual({ok: true, value: state});
  });
  it.each([false, 'true', 1, null])(
    'rejects malformed media picture provenance %j',
    slidePicture => {
      const state = {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          media: {mediaId: 'picture', loop: false, startedAt: 0, slidePicture},
        },
      };
      expect(parseLiveState(state).ok).toBe(false);
    },
  );
  it('accepts a slide picture ID and rejects malformed IDs', () => {
    const base = busyState();
    const state = {
      ...base,
      layers: {
        ...base.layers,
        slide: {
          ...base.layers.slide,
          picture: '00000000-0000-4000-8000-000000000901',
        },
      },
    };
    expect(parseLiveState(state)).toEqual({ok: true, value: state});
    expect(
      parseLiveState({
        ...state,
        layers: {
          ...state.layers,
          slide: {...state.layers.slide, picture: 'bad-id'},
        },
      }).ok,
    ).toBe(false);
  });
  it('carries a bounded optional slide name separately from label, title, and reference', () => {
    const slide = {
      itemId: 'item-1',
      position: 0,
      label: 'Label',
      lines: [],
      title: 'Item',
      reference: '3:16',
    };
    for (const name of [
      '',
      'Event',
      'x'.repeat(LIVE_STATE_LIMITS.textCharacters),
    ]) {
      const state = {
        ...emptyLiveState(),
        layers: {...emptyLiveState().layers, slide: {...slide, name}},
      };
      expect(parseLiveState(state)).toEqual({ok: true, value: state});
    }
    for (const name of [
      null,
      1,
      undefined,
      'x'.repeat(LIVE_STATE_LIMITS.textCharacters + 1),
    ]) {
      expect(
        parseLiveState({
          ...emptyLiveState(),
          layers: {...emptyLiveState().layers, slide: {...slide, name}},
        }).ok,
      ).toBe(false);
    }
  });

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

  it('carries the next slide and the stage 타이머', () => {
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
      stageTimerId: screenUuid(6),
    };
    expect(parseLiveState(state)).toEqual({ok: true, value: state});
    const field = (change: object) => {
      const result = parseLiveState({...emptyLiveState(), ...change});
      return result.ok ? undefined : result.error.field;
    };
    expect(field({stageTimerId: 'clock'})).toBe('stageTimerId');
    expect(field({stageTimerId: null})).toBe('stageTimerId');
  });

  it('rejects values that are not states', () => {
    for (const value of [null, undefined, [], 'state', 3]) {
      expect(parseLiveState(value).ok).toBe(false);
    }
  });
});
