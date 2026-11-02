import {describe, expect, it} from 'vitest';
import {
  parseAppInfo,
  parsePreferencePage,
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

describe('the 환경설정 page request', () => {
  it.each(['general', 'shortcuts'])('accepts %s', page => {
    expect(parsePreferencePage(page)).toEqual({ok: true, value: page});
  });

  it.each(['', 'Shortcuts', 3, null, undefined])('rejects %j', value => {
    expect(parsePreferencePage(value)).toMatchObject({ok: false});
  });
});

describe('the app info', () => {
  it('accepts a name and a version', () => {
    expect(parseAppInfo({name: 'LoveLight', version: '1.0.0'})).toEqual({
      ok: true,
      value: {name: 'LoveLight', version: '1.0.0'},
    });
  });

  it.each([null, {}, {name: 'LoveLight'}, {name: 1, version: '1'}])(
    'rejects %j',
    value => {
      expect(parseAppInfo(value)).toMatchObject({ok: false});
    },
  );
});
