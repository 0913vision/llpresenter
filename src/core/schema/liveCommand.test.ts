import {describe, expect, it} from 'vitest';
import {layerKinds} from '../live/state';
import {parseLiveCommand, parseLiveCommandRequest} from './liveCommand';

describe('parseLiveCommand', () => {
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
  it('returns every well-formed command unchanged', () => {
    const commands: unknown[] = [
      {type: 'clear.undo'},
      {type: 'layer.clear', target: 'all'},
      ...layerKinds.map(target => ({type: 'layer.clear', target})),
      ...['all', ...layerKinds].map(target => ({
        type: 'layer.clear.toggle',
        target,
      })),
      {type: 'output.set', screenId: 'main', on: true},
      {
        type: 'slide.show',
        slide: {itemId: 'a', position: 2, label: '후렴', lines: ['아멘']},
      },
      {type: 'media.show', media: {mediaId: 'warm-light', loop: false}},
      {type: 'message.show', message: {messageId: 'car', text: '12가 3456'}},
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
    [
      'an empty screen id',
      {type: 'output.set', screenId: '', on: true},
      'screenId',
    ],
    [
      'an output switch that is text',
      {type: 'output.set', screenId: 'main', on: 'yes'},
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
