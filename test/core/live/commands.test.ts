import {describe, expect, it} from 'vitest';
import {
  interruptsSongOutput,
  type SingleLiveCommand,
} from '@core/live/commands';

describe('interruptsSongOutput', () => {
  it('interrupts pending song navigation when any batch child interrupts it', () => {
    const children: readonly SingleLiveCommand[] = [
      {
        type: 'slide.show',
        slide: {itemId: 'a', position: 0, label: null, lines: []},
      },
      {type: 'media.show', media: {mediaId: 'a', loop: false}},
      {type: 'clear.undo'},
      {type: 'item.restore'},
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
        type: 'overlay.clear',
        target: {kind: 'stage-message'},
      }),
    ).toBe(false);
    expect(
      interruptsSongOutput({
        type: 'message.show',
        message: {messageId: 'a', text: ''},
      }),
    ).toBe(false);
  });
});
