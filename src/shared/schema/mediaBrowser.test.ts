import {describe, expect, it} from 'vitest';
import {parseAppConfig, serializeAppConfig} from './appConfig';
import {MEDIA_BROWSER, parseMediaBrowserChange} from './mediaBrowser';
import {parsePrepMediaChange, parseUiState} from './uiState';
import {expectSuccess} from './testHelpers';

describe('media browser UI boundaries', () => {
  it.each([
    MEDIA_BROWSER.minColumns,
    MEDIA_BROWSER.defaultColumns,
    MEDIA_BROWSER.maxColumns,
  ])('accepts bounded column count %s alone and with either view', columns => {
    expect(parseMediaBrowserChange({columns})).toEqual({
      ok: true,
      value: {columns},
    });
    for (const view of ['grid', 'list']) {
      const change = {columns, view};
      expect(parseMediaBrowserChange(change)).toEqual({
        ok: true,
        value: change,
      });
      expect(parseMediaBrowserChange({view})).toEqual({
        ok: true,
        value: {view},
      });
    }
  });

  it.each([
    null,
    [],
    {},
    {future: true},
    {columns: 1},
    {columns: 9},
    {columns: 2.5},
    {columns: '5'},
    {columns: null},
    {columns: undefined},
    {columns: NaN},
    {columns: Infinity},
    {view: 'tiles'},
    {view: 0},
    {view: 'list', columns: -1},
  ])('rejects malformed or empty updates %j', value => {
    expect(parseMediaBrowserChange(value).ok).toBe(false);
  });

  it('drops unrelated fields from commands without admitting them to app.json', () => {
    expect(
      parseMediaBrowserChange({
        columns: 3,
        view: 'list',
        dataRoot: 'unrelated',
        future: true,
      }),
    ).toEqual({ok: true, value: {columns: 3, view: 'list'}});
  });

  it.each([true, false])(
    'keeps prep media visibility %s distinct from media strip visibility',
    visible => {
      expect(parsePrepMediaChange({visible, mediaStrip: !visible})).toEqual({
        ok: true,
        value: {visible},
      });
      expect(
        parseUiState({
          prepMedia: visible,
          mediaStrip: !visible,
          mediaBrowser: {columns: 2, view: 'list'},
        }).ok,
      ).toBe(true);
    },
  );

  it.each([null, {}, [], {visible: 'true'}, {visible: 1}])(
    'rejects malformed prep visibility %j',
    value => {
      expect(parsePrepMediaChange(value).ok).toBe(false);
    },
  );

  it('round-trips app state and unknown nested metadata without adding defaults', () => {
    const file = 'app.json';
    const config = {
      format: 'llapp',
      schemaVersion: 1,
      prepMedia: false,
      mediaBrowser: {columns: 8, view: 'list', future: {keep: true}},
      future: true,
    };
    const loaded = expectSuccess(
      parseAppConfig(JSON.stringify(config), file),
    ).data;
    expect(loaded).toEqual(config);
    expect(JSON.parse(expectSuccess(serializeAppConfig(loaded, file)))).toEqual(
      config,
    );
    expect(
      expectSuccess(
        parseAppConfig('{"format":"llapp","schemaVersion":1}', file),
      ).data,
    ).toEqual({format: 'llapp', schemaVersion: 1});
    expect(parseUiState({})).toEqual({ok: true, value: {}});
  });

  it.each([{columns: 9}, {view: 'other'}, []])(
    'rejects malformed persisted and IPC state %j',
    mediaBrowser => {
      expect(parseUiState({mediaBrowser}).ok).toBe(false);
      expect(
        parseAppConfig(
          JSON.stringify({format: 'llapp', schemaVersion: 1, mediaBrowser}),
          'app.json',
        ).ok,
      ).toBe(false);
    },
  );
});
