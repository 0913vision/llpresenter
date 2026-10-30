import {describe, expect, it} from 'vitest';
import {parseAppConfig, serializeAppConfig} from './appConfig';
import {
  parseUiZoomCommand,
  parseUiZoomFactor,
  parseUiZoomPercent,
  UI_ZOOM,
  UI_ZOOM_FACTOR,
} from './uiZoom';
import {expectSuccess} from './testHelpers';

describe('UI zoom contract', () => {
  it.each([UI_ZOOM_FACTOR.min, 1.2, UI_ZOOM_FACTOR.max])(
    'accepts actual browser factor %s',
    factor => {
      expect(parseUiZoomFactor(factor)).toEqual({ok: true, value: factor});
    },
  );

  it.each([undefined, null, 0.9, 2.1, NaN, Infinity, '1.2', [], {}])(
    'rejects invalid browser factor %j',
    factor => {
      expect(parseUiZoomFactor(factor).ok).toBe(false);
    },
  );
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
