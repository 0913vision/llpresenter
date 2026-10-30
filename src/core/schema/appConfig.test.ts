import {describe, expect, expectTypeOf, it} from 'vitest';
import {
  parseAppConfig,
  serializeAppConfig,
  type AppLayout,
  type ColumnLayout,
  type SizeClass,
} from './appConfig';
import {expectFailure, expectSuccess} from './testHelpers';

const FILE = 'C:\\data\\app.json';
const SERVICE_ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
const SCREEN_ID = '9e8d7c6b-5a49-4382-b170-6f5e4d3c2b1a';
const COLLECTION_ID = '1a2b3c4d-5e6f-4a0b-9c1d-2e3f4a5b6c7d';

function fullConfig() {
  return {
    format: 'llapp',
    schemaVersion: 1,
    dataRoot: 'C:\\data\\LoveLight',
    songsPath: '',
    mediaPath: 'E:\\data\\media',
    backupPath: '',
    lastServiceId: SERVICE_ID,
    layout: {
      narrow: {left: 220, right: 360, columns: 3, thumbnailScalePercent: 123},
      normal: {left: 312.5, right: 480, leftCollapsed: true},
      wide: {columns: 6},
    },
    previewBig: SCREEN_ID,
    macroView: 'grid',
    macroCollection: COLLECTION_ID,
    mediaStrip: true,
    mediaImportFolder: 'C:\\data\\imports',
    lastBackupAt: '2026-10-24T09:00:00+09:00',
  };
}

function parse(json: unknown) {
  return parseAppConfig(JSON.stringify(json), FILE);
}

describe('parseAppConfig', () => {
  it.each([null, 42, {}, []])(
    'rejects an invalid import folder %j',
    mediaImportFolder => {
      expect(
        expectFailure(parse({...fullConfig(), mediaImportFolder})),
      ).toMatchObject({field: 'mediaImportFolder'});
    },
  );

  it('reads a file with every field', () => {
    expect(expectSuccess(parse(fullConfig())).data).toEqual(fullConfig());
  });

  it('reads a new file with only the header', () => {
    const config = {format: 'llapp', schemaVersion: 1};

    expect(expectSuccess(parse(config)).data).toEqual(config);
  });

  it('round-trips an old layout without adding a scale or converting its columns', () => {
    const config = {
      format: 'llapp',
      schemaVersion: 1,
      layout: {narrow: {columns: 3}, normal: {left: 300, right: 500}, wide: {}},
    };
    const loaded = expectSuccess(parse(config));

    expect(loaded.data).toEqual(config);
    expect(
      JSON.parse(expectSuccess(serializeAppConfig(loaded.data, FILE))),
    ).toEqual(config);
  });

  it.each([50, 100, 123, 200, 1, 201, 999])(
    'preserves a positive scale of %i for the shell to clamp on read',
    thumbnailScalePercent => {
      const config = {
        ...fullConfig(),
        layout: Object.fromEntries(
          ['narrow', 'normal', 'wide'].map(sizeClass => [
            sizeClass,
            {columns: 4, thumbnailScalePercent, future: {enabled: true}},
          ]),
        ),
      };
      const loaded = expectSuccess(parse(config));

      expect(loaded.data).toEqual(config);
      expect(
        JSON.parse(expectSuccess(serializeAppConfig(loaded.data, FILE))),
      ).toEqual(config);
    },
  );

  it.each([0, -1, 50.5, '100', null])(
    'rejects an invalid stored thumbnail scale %j',
    thumbnailScalePercent => {
      const error = expectFailure(
        parse({
          ...fullConfig(),
          layout: {normal: {thumbnailScalePercent}},
        }),
      );
      expect(error).toMatchObject({
        kind: 'invalid',
        file: FILE,
        field: 'layout.normal.thumbnailScalePercent',
      });
    },
  );

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
    ['a layout that is an array', {layout: []}, 'layout'],
    ['a size class that is an array', {layout: {normal: []}}, 'layout.normal'],
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
    expectTypeOf<keyof AppLayout>().toEqualTypeOf<SizeClass>();
    expectTypeOf<ColumnLayout>().toEqualTypeOf<{
      readonly leftCollapsed?: boolean;
      readonly left?: number;
      readonly right?: number;
      readonly columns?: number;
      readonly thumbnailScalePercent?: number;
    }>();
  });
});

it.each(['true', 0, null, [], {}])(
  'rejects an invalid stored sidebar state %j',
  leftCollapsed => {
    const error = expectFailure(
      parse({...fullConfig(), layout: {narrow: {leftCollapsed}}}),
    );
    expect(error).toMatchObject({field: 'layout.narrow.leftCollapsed'});
  },
);
