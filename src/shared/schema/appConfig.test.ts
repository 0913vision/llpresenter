import {describe, expect, expectTypeOf, it} from 'vitest';
import {
  parseAppConfig,
  serializeAppConfig,
  type ColumnLayout,
  type SizeClass,
} from './appConfig';
import {expectFailure, expectSuccess} from './testHelpers';

const FILE = 'D:\\llp-dev\\data\\app.json';
const SERVICE_ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
const SCREEN_ID = '9e8d7c6b-5a49-4382-b170-6f5e4d3c2b1a';
const COLLECTION_ID = '1a2b3c4d-5e6f-4a0b-9c1d-2e3f4a5b6c7d';

function fullConfig() {
  return {
    format: 'llapp',
    schemaVersion: 1,
    dataRoot: 'D:\\llp-dev\\data\\LoveLight',
    songsPath: '',
    mediaPath: 'E:\\미디어',
    backupPath: '',
    lastServiceId: SERVICE_ID,
    layout: {
      narrow: {left: 220, right: 360, columns: 3},
      normal: {left: 312.5, right: 480},
      wide: {columns: 6},
    },
    previewBig: SCREEN_ID,
    macroView: 'grid',
    macroCollection: COLLECTION_ID,
    mediaStrip: true,
    lastBackupAt: '2026-10-24T09:00:00+09:00',
  };
}

function parse(json: unknown) {
  return parseAppConfig(JSON.stringify(json), FILE);
}

describe('parseAppConfig', () => {
  it('reads a file with every field', () => {
    expect(expectSuccess(parse(fullConfig())).data).toEqual(fullConfig());
  });

  it('reads a new file with only the header', () => {
    const config = {format: 'llapp', schemaVersion: 1};

    expect(expectSuccess(parse(config)).data).toEqual(config);
  });

  it('keeps unknown fields in the file and in each size class', () => {
    const config = fullConfig();
    const withUnknown = {
      ...config,
      window: {x: 0, y: 0},
      layout: {...config.layout, narrow: {left: 200, collapsed: true}},
    };

    const loaded = expectSuccess(parse(withUnknown));
    const text = expectSuccess(serializeAppConfig(loaded.data, FILE));

    expect(JSON.parse(text)).toEqual(withUnknown);
  });

  it.each([
    ['a negative width', {layout: {normal: {left: -1}}}, 'layout.normal.left'],
    [
      'a width that is text',
      {layout: {wide: {right: '480'}}},
      'layout.wide.right',
    ],
    [
      'zero thumbnail columns',
      {layout: {narrow: {columns: 0}}},
      'layout.narrow.columns',
    ],
    [
      'a screen name for the large preview',
      {previewBig: '본 화면'},
      'previewBig',
    ],
    ['an unknown macro view', {macroView: 'tiles'}, 'macroView'],
    [
      'a backup time without an offset',
      {lastBackupAt: '2026-10-24T09:00:00'},
      'lastBackupAt',
    ],
    ['a folder that is not text', {dataRoot: null}, 'dataRoot'],
  ])('rejects %s', (_name, change, field) => {
    const error = expectFailure(parse({...fullConfig(), ...change}));

    expect(error).toMatchObject({kind: 'invalid', file: FILE, field});
  });
});

describe('app config types', () => {
  it('names the size classes of the design system', () => {
    expectTypeOf<SizeClass>().toEqualTypeOf<'narrow' | 'normal' | 'wide'>();
    expectTypeOf<ColumnLayout>().toEqualTypeOf<{
      readonly left?: number;
      readonly right?: number;
      readonly columns?: number;
    }>();
  });
});
