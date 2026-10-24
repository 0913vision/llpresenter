import {describe, expect, it} from 'vitest';
import {emptyLiveState, type LiveState} from '../live';
import {parseLiveState} from './liveState';

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

  it('accepts a background without a start time', () => {
    const state = busyState();
    const media = {mediaId: 'warm-light', loop: false};

    expect(
      parseLiveState({...state, layers: {...state.layers, media}}).ok,
    ).toBe(true);
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

  it('rejects values that are not states', () => {
    for (const value of [null, undefined, [], 'state', 3]) {
      expect(parseLiveState(value).ok).toBe(false);
    }
  });
});
