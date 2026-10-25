import {describe, expect, it} from 'vitest';
import {parseAppConfig, serializeAppConfig} from './appConfig';
import {parseUiZoomCommand, parseUiZoomPercent, UI_ZOOM} from './uiZoom';
import {expectSuccess} from './testHelpers';

describe('UI zoom contract', () => {
  it.each(Array.from({length: 11}, (_, index) => 100 + index * 10))(
    'accepts %i percent',
    percent => {
      expect(parseUiZoomPercent(percent)).toEqual({ok: true, value: percent});
    },
  );

  it.each([90, 105, 201, 210, 110.5, NaN, Infinity, '110', null, {}, []])(
    'rejects invalid IPC zoom %j',
    value => {
      expect(parseUiZoomPercent(value).ok).toBe(false);
    },
  );

  it.each(['ui.zoomIn', 'ui.zoomOut', 'ui.zoomReset'])('accepts %s', type => {
    expect(parseUiZoomCommand({type})).toEqual({ok: true, value: {type}});
  });

  it.each([
    undefined,
    null,
    [],
    'ui.zoomIn',
    {},
    {type: 'ui.resetLayout'},
    {type: 1},
  ])('refuses a malformed zoom command %j', value => {
    expect(parseUiZoomCommand(value).ok).toBe(false);
  });

  it.each([90, 105, 210, '150', null, {}, []])(
    'defaults invalid stored zoom %j while keeping other fields',
    uiZoomPercent => {
      const json = {
        format: 'llapp',
        schemaVersion: 1,
        uiZoomPercent,
        layout: {normal: {left: 280, future: true}},
        future: {keep: true},
      };
      const loaded = expectSuccess(
        parseAppConfig(JSON.stringify(json), 'app.json'),
      );
      expect(loaded.data).toEqual({
        ...json,
        uiZoomPercent: UI_ZOOM.defaultPercent,
      });
      expect(
        JSON.parse(expectSuccess(serializeAppConfig(loaded.data, 'app.json'))),
      ).toEqual({...json, uiZoomPercent: UI_ZOOM.defaultPercent});
    },
  );
});
