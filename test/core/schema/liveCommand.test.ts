import {describe, expect, it} from 'vitest';
import {layerKinds} from '@core/live/state';
import {
  parseLiveCommand,
  parseLiveCommandRequest,
  MAX_LIVE_BATCH_COMMANDS,
} from '@core/schema/liveCommand';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';

describe('parseLiveCommand', () => {
  it('checks explicit continuation metadata on the current and next Bible parts', () => {
    const slide = {
      itemId: 'bible',
      position: 0,
      biblePart: 1,
      sourceSlideId: '00000000-0000-4000-8000-000000000911',
      label: '3:16',
      lines: ['가나 (계속)'],
      continued: true,
      next: {label: '3:16', lines: ['다라'], continued: false},
    };
    expect(parseLiveCommand({type: 'slide.show', slide})).toEqual({
      ok: true,
      value: {type: 'slide.show', slide},
    });
    for (const sourceSlideId of ['bad-id', null, 1]) {
      expect(
        parseLiveCommand({type: 'slide.show', slide: {...slide, sourceSlideId}})
          .ok,
      ).toBe(false);
    }
    for (const biblePart of [0, -1, 1.5, 10_001, '1', null]) {
      expect(
        parseLiveCommand({type: 'slide.show', slide: {...slide, biblePart}}).ok,
      ).toBe(false);
    }
    for (const continued of ['true', null, 1]) {
      expect(
        parseLiveCommand({type: 'slide.show', slide: {...slide, continued}}).ok,
      ).toBe(false);
      expect(
        parseLiveCommand({
          type: 'slide.show',
          slide: {...slide, next: {...slide.next, continued}},
        }).ok,
      ).toBe(false);
    }
  });
  it('preserves slide picture provenance in a media command', () => {
    const command = {
      type: 'media.show',
      media: {
        mediaId: 'picture',
        loop: false,
        itemId: 'item',
        slidePicture: true,
      },
    };
    expect(parseLiveCommand(command)).toEqual({ok: true, value: command});
    expect(
      parseLiveCommand({
        ...command,
        media: {...command.media, slidePicture: false},
      }).ok,
    ).toBe(false);
  });
  it('preserves an explicit Bible reference on a slide command', () => {
    const command = {
      type: 'slide.show',
      slide: {
        itemId: 'bible',
        position: 0,
        label: '3:16',
        lines: ['Invented'],
        reference: '3:16',
      },
    };
    expect(parseLiveCommand(command)).toEqual({ok: true, value: command});
  });
  it('keeps the next 장 of a slide command', () => {
    const command = {
      type: 'slide.show',
      slide: {
        itemId: 'item-1',
        position: 0,
        label: '1절',
        lines: ['첫 줄'],
        next: {label: '후렴', lines: ['둘째 줄']},
      },
    };
    expect(parseLiveCommand(command)).toEqual({ok: true, value: command});
  });

  it('returns every well-formed command unchanged', () => {
    const commands: unknown[] = [
      {type: 'clear.undo'},
      {type: 'layer.clear', target: 'all'},
      ...layerKinds.map(target => ({type: 'layer.clear', target})),
      ...['all', ...layerKinds].map(target => ({
        type: 'layer.clear.toggle',
        target,
      })),
      {type: 'output.set', screenId: MAIN_SCREEN, on: true},
      {
        type: 'slide.show',
        slide: {itemId: 'a', position: 2, label: '후렴', lines: ['아멘']},
      },
      {type: 'media.show', media: {mediaId: 'warm-light', loop: false}},
      {type: 'message.show', message: {messageId: 'car', text: '12가 3456'}},
      {type: 'theme.set', themeId: '00000000-0000-4000-8000-000000000111'},
      {type: 'themes.refresh'},
      {type: 'item.stop'},
      {type: 'item.restore'},
    ];

    for (const command of commands) {
      expect(parseLiveCommand(command)).toEqual({ok: true, value: command});
    }
  });

  it('drops fields a command does not have, such as a start time', () => {
    expect(
      parseLiveCommand({
        type: 'media.show',
        media: {mediaId: 'warm-light', loop: true, startedAt: 5},
        sender: 'control',
      }),
    ).toEqual({
      ok: true,
      value: {type: 'media.show', media: {mediaId: 'warm-light', loop: true}},
    });
  });

  it.each([
    ['an unknown type', {type: 'delete.everything'}, 'type'],
    [
      'an unknown toggle target',
      {type: 'layer.clear.toggle', target: 'slides'},
      'target',
    ],
    ['a missing toggle target', {type: 'layer.clear.toggle'}, 'target'],
    ['no type', {target: 'all'}, 'type'],
    [
      'an unknown clear target',
      {type: 'layer.clear', target: 'slides'},
      'target',
    ],
    ['a missing clear target', {type: 'layer.clear'}, 'target'],
    [
      'a theme ID that is not an ID',
      {type: 'theme.set', themeId: 'missing'},
      'themeId',
    ],
    ['a missing theme ID', {type: 'theme.set'}, 'themeId'],
    [
      'an empty screen id',
      {type: 'output.set', screenId: '', on: true},
      'screenId',
    ],
    [
      'an output switch that is text',
      {type: 'output.set', screenId: MAIN_SCREEN, on: 'yes'},
      'on',
    ],
    [
      'media without loop',
      {type: 'media.show', media: {mediaId: 'x'}},
      'media.loop',
    ],
    [
      'a slide at a negative position',
      {
        type: 'slide.show',
        slide: {itemId: 'a', position: -1, label: null, lines: []},
      },
      'slide.position',
    ],
    [
      'a slide label that is not text',
      {
        type: 'slide.show',
        slide: {itemId: 'a', position: 0, label: 3, lines: []},
      },
      'slide.label',
    ],
    [
      'a slide with a line that is not text',
      {
        type: 'slide.show',
        slide: {itemId: 'a', position: 0, label: null, lines: [1]},
      },
      'slide.lines.0',
    ],
    [
      'a message without text',
      {type: 'message.show', message: {messageId: 'car'}},
      'message.text',
    ],
  ])('names the field of %s', (_name, value, field) => {
    const result = parseLiveCommand(value);

    expect(result.ok ? undefined : result.error.field).toBe(field);
  });

  it('rejects an array or an object whose fields are inherited', () => {
    const arrayCommand = Object.assign([], {type: 'clear.undo'});
    const inherited: unknown = Object.create({type: 'clear.undo'});

    expect(parseLiveCommand(arrayCommand).ok).toBe(false);
    expect(parseLiveCommand(inherited).ok).toBe(false);
  });

  it('rejects a layer that is an array with the right fields', () => {
    const media = Object.assign([], {mediaId: 'warm-light', loop: true});

    const result = parseLiveCommand({type: 'media.show', media});

    expect(result.ok ? undefined : result.error.field).toBe('media');
  });

  it('rejects a hole in the lines, which the old guard let through', () => {
    const lines: string[] = [];
    lines[1] = '아멘';

    const result = parseLiveCommand({
      type: 'slide.show',
      slide: {itemId: 'a', position: 0, label: null, lines},
    });

    expect(lines.every(line => typeof line === 'string')).toBe(true);
    expect(result.ok ? undefined : result.error.field).toBe('slide.lines.0');
  });

  it('rejects values that are not commands', () => {
    for (const value of [null, undefined, 'clear.undo', [], 3]) {
      expect(parseLiveCommand(value).ok).toBe(false);
    }
  });
});

describe('parseLiveCommandRequest', () => {
  it('keeps the valid children of a batch and names each skipped one', () => {
    const child = {type: 'audio.pause'};
    const parsed = parseLiveCommandRequest({
      type: 'live.batch',
      commands: [child, {type: 'unknown'}, {type: 'timer.start'}],
    });
    expect(parsed.ok && parsed.value.command).toEqual({
      type: 'live.batch',
      commands: [child],
    });
    expect(parsed.ok && parsed.value.rejected.map(({field}) => field)).toEqual([
      'commands.1.type',
      'commands.2.timerId',
    ]);
  });

  it('passes a single valid command with nothing rejected', () => {
    const command = {type: 'clear.undo'};
    expect(parseLiveCommandRequest(command)).toEqual({
      ok: true,
      value: {command, rejected: []},
    });
  });

  it('refuses a single malformed command as a whole', () => {
    expect(parseLiveCommandRequest({type: 'audio.play', source: []}).ok).toBe(
      false,
    );
  });
});

describe('live batch requests', () => {
  const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
  const first = {type: 'theme.set', themeId: ID};
  const second = {type: 'timer.start', timerId: ID};

  it('accepts bounded flat batches, strips fields, and preserves order', () => {
    const value = {type: 'live.batch', commands: [first, second]};
    expect(
      expectSuccess(
        parseLiveCommand({
          ...value,
          extra: true,
          commands: [{...first, extra: true}, second],
        }),
      ),
    ).toEqual(value);
    for (const commands of [
      [],
      Array.from({length: MAX_LIVE_BATCH_COMMANDS}, () => first),
    ]) {
      expect(parseLiveCommand({type: 'live.batch', commands}).ok).toBe(true);
    }
  });

  it('keeps valid children and returns indexed errors for bad children', () => {
    const request = {
      type: 'live.batch',
      commands: [
        first,
        {type: 'timer.start', timerId: 'broken'},
        {type: 'unknown'},
        {type: 'live.batch', commands: [second]},
        second,
      ],
    };
    expect(parseLiveCommand(request).ok).toBe(false);
    const parsed = expectSuccess(parseLiveCommandRequest(request));
    expect(parsed.command).toEqual({
      type: 'live.batch',
      commands: [first, second],
    });
    expect(parsed.rejected.map(({field}) => field)).toEqual([
      'commands.1.timerId',
      'commands.2.type',
      'commands.3.type',
    ]);
    expect(parseLiveCommand(parsed.command).ok).toBe(true);
  });

  it('rejects malformed envelopes and excessive batches before reading children', () => {
    for (const value of [
      {type: 'live.batch'},
      {type: 'live.batch', commands: {}},
      {
        type: 'live.batch',
        commands: Array(MAX_LIVE_BATCH_COMMANDS + 1).fill(first),
      },
      Object.assign([], {type: 'live.batch', commands: []}),
    ]) {
      expect(parseLiveCommand(value).ok).toBe(false);
      expect(parseLiveCommandRequest(value).ok).toBe(false);
    }
  });

  it('reports sparse and entirely invalid children without inventing actions', () => {
    const commands: unknown[] = [];
    commands[1] = null;
    const result = expectSuccess(
      parseLiveCommandRequest({type: 'live.batch', commands}),
    );
    expect(result.command).toEqual({type: 'live.batch', commands: []});
    expect(result.rejected.map(({field}) => field)).toEqual([
      'commands.0',
      'commands.1',
    ]);
  });
});
