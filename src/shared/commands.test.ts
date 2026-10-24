import {describe, expect, it} from 'vitest';
import {isLiveCommand} from './commands';

describe('isLiveCommand', () => {
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
