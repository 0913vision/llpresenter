import {join, resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  DATA_FOLDER_NAME,
  readLocationFields,
  resolveLocations,
} from './locations';

const DOCUMENTS = resolve('/Users/operator/Documents');
const DEVELOPMENT = resolve('/llp-dev/data');
const IN_DEVELOPMENT = join(DEVELOPMENT, 'elsewhere');
const OUTSIDE = resolve('/Users/operator/Documents/LoveLight');

describe('resolveLocations', () => {
  it('puts the data folder in Documents by default', () => {
    const {locations, ignored} = resolveLocations(
      {},
      {documents: DOCUMENTS, developmentFolder: null},
    );

    const root = join(DOCUMENTS, DATA_FOLDER_NAME);
    expect(locations).toEqual({
      dataRoot: root,
      songs: join(root, '곡'),
      media: join(root, '미디어'),
      services: join(root, '예배'),
      templates: join(root, '틀'),
      settings: join(root, '설정'),
      recovery: join(root, '.복구 사본'),
      backups: join(root, '백업'),
    });
    expect(ignored).toEqual([]);
  });

  it('puts the data folder inside LLP_USER_DATA in development', () => {
    const {locations} = resolveLocations(
      {},
      {documents: DOCUMENTS, developmentFolder: DEVELOPMENT},
    );

    expect(locations.dataRoot).toBe(join(DEVELOPMENT, DATA_FOLDER_NAME));
    const folders = [
      locations.dataRoot,
      locations.songs,
      locations.media,
      locations.services,
      locations.templates,
      locations.settings,
      locations.recovery,
      locations.backups,
    ];
    for (const folder of folders) {
      expect(folder.startsWith(DEVELOPMENT)).toBe(true);
    }
  });

  it('never lets app.json send a development run outside LLP_USER_DATA', () => {
    const {locations, ignored} = resolveLocations(
      {dataRoot: OUTSIDE, songsPath: OUTSIDE, backupPath: IN_DEVELOPMENT},
      {documents: DOCUMENTS, developmentFolder: DEVELOPMENT},
    );

    expect(locations.dataRoot).toBe(join(DEVELOPMENT, DATA_FOLDER_NAME));
    expect(locations.songs).toBe(join(locations.dataRoot, '곡'));
    expect(locations.backups).toBe(IN_DEVELOPMENT);
    expect(ignored).toEqual(['dataRoot', 'songsPath']);
  });

  it('uses the folders app.json sets, and the defaults for empty ones', () => {
    const songs = resolve('/Volumes/찬양/곡');
    const {locations} = resolveLocations(
      {dataRoot: '', songsPath: songs, mediaPath: ''},
      {documents: DOCUMENTS, developmentFolder: null},
    );

    expect(locations.dataRoot).toBe(join(DOCUMENTS, DATA_FOLDER_NAME));
    expect(locations.songs).toBe(songs);
    expect(locations.media).toBe(join(locations.dataRoot, '미디어'));
  });

  it('ignores a folder that is not absolute', () => {
    const {locations, ignored} = resolveLocations(
      {mediaPath: 'media'},
      {documents: DOCUMENTS, developmentFolder: null},
    );

    expect(locations.media).toBe(join(locations.dataRoot, '미디어'));
    expect(ignored).toEqual(['mediaPath']);
  });
});

describe('readLocationFields', () => {
  const header = {format: 'llapp', schemaVersion: 1};

  it('reads the location fields of a valid file', () => {
    const read = readLocationFields(
      JSON.stringify({...header, dataRoot: OUTSIDE, mediaStrip: true}),
      'app.json',
    );

    expect(read).toEqual({fields: {dataRoot: OUTSIDE}, problem: null});
  });

  it('keeps the location fields of a file that fails validation', () => {
    const read = readLocationFields(
      JSON.stringify({
        ...header,
        dataRoot: OUTSIDE,
        songsPath: 7,
        layout: {normal: {left: 'wide'}},
      }),
      'app.json',
    );

    expect(read.fields).toEqual({dataRoot: OUTSIDE});
    expect(read.problem).toMatchObject({
      kind: 'invalid',
      field: 'songsPath',
    });
  });

  it('gives no fields for text that is not JSON, and reports it', () => {
    const read = readLocationFields('{"dataRoot": ', 'app.json');

    expect(read.fields).toEqual({});
    expect(read.problem?.kind).toBe('json');
  });

  it('reads a file that starts with a byte order mark', () => {
    const text = `\uFEFF${JSON.stringify({...header, layout: []})}`;

    expect(readLocationFields(text, 'app.json').fields).toEqual({});
    expect(
      readLocationFields(
        `\uFEFF${JSON.stringify({dataRoot: OUTSIDE})}`,
        'app.json',
      ).fields,
    ).toEqual({dataRoot: OUTSIDE});
  });
});
