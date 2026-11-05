import {describe, expect, it} from 'vitest';
import {
  interruptsSongOutput,
  type SingleLiveCommand,
} from '@core/live/commands';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';

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
            {type: 'output.set', screenId: MAIN_SCREEN, on: true},
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
          {type: 'output.set', screenId: MAIN_SCREEN, on: true},
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
    for (const target of ['prop', 'message', 'audio'] as const) {
      expect(interruptsSongOutput({type: 'layer.clear', target})).toBe(false);
    }
    expect(
      interruptsSongOutput({
        type: 'output.set',
        screenId: MAIN_SCREEN,
        on: true,
      }),
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

describe('interruptsSongOutput for overlay, stage, audio, and 매크로 actions', () => {
  const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
  it.each([
    {type: 'message.expire', messageId: ID, expiresAt: 1_700_000_000_000},
    {type: 'theme.set', themeId: ID},
    {type: 'stage.message.set', text: 'Start again'},
    {type: 'stage.timer.set', timerId: ID},
    {type: 'prop.set', propId: ID, on: true},
    {
      type: 'message.send',
      text: 'Come forward',
      targets: 'all',
      duration: null,
    },
    {type: 'timer.start', timerId: ID},
    {type: 'audio.play'},
    {type: 'audio.volume.set', volume: 55.5},
    {type: 'macro.run', macroId: ID},
    {type: 'item.start', itemId: ID},
  ])('leaves song navigation alone for $type', value => {
    expect(interruptsSongOutput(expectSuccess(parseLiveCommand(value)))).toBe(
      false,
    );
  });
});
