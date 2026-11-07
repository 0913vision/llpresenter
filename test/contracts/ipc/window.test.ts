import {describe, expect, it} from 'vitest';
import {
  parseAppInfo,
  DIAGNOSTICS_TEXT_LIMIT,
  parseDiagnosticsText,
  parseOnOff,
  parsePreferencePage,
  parseWindowAction,
  parseTextEditAction,
  textEditActions,
  windowEndpoints,
  parsePreferencesRequest,
  PREFERENCES_REQUEST_LIMIT,
  parseSettingsRequest,
} from '@contracts/ipc/window';

describe('the shared settings request', () => {
  it.each(['screens', 'preferences'])(
    'accepts %s with a bounded identity and strips extra fields',
    view => {
      for (const requestId of [0, PREFERENCES_REQUEST_LIMIT]) {
        for (const preparing of [true, false]) {
          const value = {view, page: 'shortcuts', requestId, preparing};
          expect(parseSettingsRequest({...value, extra: true})).toEqual({
            ok: true,
            value,
          });
        }
      }
    },
  );
  it.each([
    null,
    {},
    {view: 'other', page: 'general', requestId: 0, preparing: false},
    {view: 'screens', page: 'other', requestId: 0, preparing: false},
    {view: 'screens', page: 'general', requestId: -1, preparing: false},
    {
      view: 'screens',
      page: 'general',
      requestId: PREFERENCES_REQUEST_LIMIT + 1,
      preparing: false,
    },
    {view: 'screens', page: 'general', requestId: 0.5, preparing: false},
    {view: 'screens', page: 'general', requestId: 0, preparing: 'false'},
    {view: 'screens', page: 'general', requestId: 0},
  ])('rejects malformed request %j', value => {
    expect(parseSettingsRequest(value).ok).toBe(false);
  });
});

describe('preferences request identity', () => {
  it.each([0, PREFERENCES_REQUEST_LIMIT])(
    'accepts bounded identity %s and a known page',
    requestId => {
      expect(
        parsePreferencesRequest({requestId, page: 'shortcuts', extra: true}),
      ).toEqual({ok: true, value: {requestId, page: 'shortcuts'}});
    },
  );
  it.each([
    null,
    {},
    {requestId: -1, page: 'general'},
    {requestId: 1.5, page: 'general'},
    {requestId: PREFERENCES_REQUEST_LIMIT + 1, page: 'general'},
    {requestId: Infinity, page: 'general'},
    {requestId: 0, page: 'unknown'},
    {requestId: '1', page: 'general'},
  ])('rejects malformed request %j', value => {
    expect(parsePreferencesRequest(value).ok).toBe(false);
  });
});

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
  it.each(['general', 'labels', 'shortcuts'])('accepts %s', page => {
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

describe('window full screen', () => {
  it('accepts the toggle action and a boolean state', () => {
    expect(parseWindowAction('toggle-full-screen')).toEqual({
      ok: true,
      value: 'toggle-full-screen',
    });
    expect(parseOnOff(true)).toEqual({ok: true, value: true});
    expect(parseOnOff(false)).toEqual({ok: true, value: false});
  });

  it.each(['true', 1, null, undefined, {}])('rejects the state %j', value => {
    expect(parseOnOff(value)).toMatchObject({ok: false});
  });
});

describe('the 자세한 기록 and 진단 정보 calls', () => {
  it('reads on and off, and refuses anything else, for the switch and its state', () => {
    expect(parseOnOff(true)).toEqual({ok: true, value: true});
    expect(windowEndpoints.verboseLogging.message(false)).toEqual({
      ok: true,
      value: false,
    });
    expect(windowEndpoints.verboseLoggingState.reply(true)).toEqual({
      ok: true,
      value: true,
    });
    for (const value of ['true', 1, null, undefined, {}]) {
      expect(parseOnOff(value)).toMatchObject({ok: false});
      expect(windowEndpoints.verboseLogging.message(value)).toMatchObject({
        ok: false,
      });
    }
  });

  it('accepts the diagnostics text up to its limit and refuses a longer or other value', () => {
    expect(
      parseDiagnosticsText('x'.repeat(DIAGNOSTICS_TEXT_LIMIT)),
    ).toMatchObject({
      ok: true,
    });
    expect(
      parseDiagnosticsText('x'.repeat(DIAGNOSTICS_TEXT_LIMIT + 1)),
    ).toMatchObject({ok: false});
    expect(parseDiagnosticsText(3)).toMatchObject({ok: false});
  });
});
