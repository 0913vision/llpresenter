import {describe, expect, it} from 'vitest';
import {
  interruptsSongOutput,
  isLiveCommand,
  type SingleLiveCommand,
} from './commands';

describe('isLiveCommand', () => {
  it('interrupts pending song navigation when any batch child interrupts it', () => {
    const children: readonly SingleLiveCommand[] = [
      {
        type: 'slide.show',
        slide: {itemId: 'a', position: 0, label: null, lines: []},
      },
      {type: 'media.show', media: {mediaId: 'a', loop: false}},
      {type: 'clear.undo'},
      {type: 'layer.clear', target: 'all'},
      {type: 'layer.clear', target: 'slide'},
      {type: 'layer.clear', target: 'media'},
    ];
    for (const child of children) {
      expect(
        interruptsSongOutput({
          type: 'live.batch',
          commands: [
            {type: 'output.set', screenId: 'main', on: true},
            child,
            {type: 'message.show', message: {messageId: 'a', text: ''}},
          ],
        }),
      ).toBe(true);
    }
  });

  it('does not interrupt pending song navigation for empty or unrelated batches', () => {
    expect(interruptsSongOutput({type: 'live.batch', commands: []})).toBe(
      false,
    );
    expect(
      interruptsSongOutput({
        type: 'live.batch',
        commands: [
          {type: 'output.set', screenId: 'main', on: true},
          {type: 'message.show', message: {messageId: 'a', text: ''}},
          {type: 'layer.clear', target: 'message'},
        ],
      }),
    ).toBe(false);
  });

  it('preserves the classification of existing song-output interruptions', () => {
    expect(interruptsSongOutput({type: 'clear.undo'})).toBe(true);
    expect(
      interruptsSongOutput({
        type: 'media.show',
        media: {mediaId: 'a', loop: false},
      }),
    ).toBe(true);
    expect(
      interruptsSongOutput({
        type: 'slide.show',
        slide: {itemId: 'a', position: 0, label: null, lines: []},
      }),
    ).toBe(true);
    for (const target of ['all', 'slide', 'media'] as const) {
      expect(interruptsSongOutput({type: 'layer.clear', target})).toBe(true);
    }
    for (const target of ['prop', 'message', 'notice', 'audio'] as const) {
      expect(interruptsSongOutput({type: 'layer.clear', target})).toBe(false);
    }
    expect(
      interruptsSongOutput({type: 'output.set', screenId: 'main', on: true}),
    ).toBe(false);
    expect(
      interruptsSongOutput({
        type: 'message.show',
        message: {messageId: 'a', text: ''},
      }),
    ).toBe(false);
  });

  it('accepts well-formed commands', () => {
    const accepted: unknown[] = [
      {type: 'clear.undo'},
      {type: 'layer.clear', target: 'all'},
      {type: 'layer.clear', target: 'notice'},
      {type: 'output.set', screenId: 'main', on: false},
      {
        type: 'slide.show',
        slide: {itemId: 'a', position: 0, label: null, lines: ['한 줄']},
      },
      {type: 'media.show', media: {mediaId: 'warm-light', loop: true}},
      {type: 'message.show', message: {messageId: 'parking', text: ''}},
    ];
    for (const value of accepted) expect(isLiveCommand(value)).toBe(true);
  });

  it('rejects unknown types and malformed payloads', () => {
    const slideWith = (fields: object): unknown => ({
      type: 'slide.show',
      slide: {itemId: 'a', position: 0, label: null, lines: [], ...fields},
    });
    const rejected: unknown[] = [
      null,
      undefined,
      'clear.undo',
      [],
      {},
      {type: 'delete.everything'},
      {type: 'layer.clear', target: 'slides'},
      {type: 'layer.clear'},
      {type: 'output.set', screenId: '', on: true},
      {type: 'output.set', screenId: 'main', on: 'yes'},
      slideWith({position: -1}),
      slideWith({position: 1.5}),
      slideWith({label: 3}),
      slideWith({lines: [1]}),
      {type: 'media.show', media: {mediaId: 'x'}},
    ];
    for (const value of rejected) expect(isLiveCommand(value)).toBe(false);
  });
});
