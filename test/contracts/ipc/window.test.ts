import {describe, expect, it} from 'vitest';
import {
  parseTextEditAction,
  textEditActions,
  windowEndpoints,
} from '@contracts/ipc/window';

describe('window text edit action', () => {
  it.each(textEditActions)('accepts %s', action => {
    expect(parseTextEditAction(action)).toEqual({ok: true, value: action});
  });

  it.each(['', 'Undo', 'delete', 7, null, undefined, {}])(
    'rejects %j',
    value => {
      expect(parseTextEditAction(value)).toMatchObject({ok: false});
    },
  );

  it('travels on its own channel', () => {
    expect(windowEndpoints.editText.channel).toBe('window:edit-text');
  });
});
