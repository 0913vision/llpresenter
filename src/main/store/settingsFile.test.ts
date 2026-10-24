import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseLabels} from '@shared/schema/labels';
import {makeTempDir} from '../../../test/temp-dir';
import {resolveLocations} from './locations';
import {
  readSettingsFile,
  settingsLocation,
  type SettingsLocation,
} from './settingsFile';
import {writeJson} from './testFiles';

const BROKEN_JSON = '{"labels": ';
const OLDER_COPY = '2026-10-24T09-00-00.000Z.json';
const NEWER_COPY = '2026-10-25T09-00-00.000Z.json';

function labelsFile(name: string, key: string | null = null) {
  return {
    format: 'llsettings.labels',
    schemaVersion: 1,
    labels: [{name, color: 'teal', key}],
  };
}

async function tempLocation(): Promise<SettingsLocation> {
  const folder = await makeTempDir();
  return {
    file: join(folder, '설정', 'labels.json'),
    copies: join(folder, '.복구 사본', 'settings', 'labels'),
  };
}

async function namesIn(location: SettingsLocation) {
  const {data} = await readSettingsFile(location, parseLabels);
  return data?.labels.map(({name}) => name) ?? null;
}

describe('settingsLocation', () => {
  it('puts the file in 설정 and its copies under settings in .복구 사본', () => {
    const {locations} = resolveLocations(
      {},
      {documents: join('C:', 'Docs'), developmentFolder: null},
    );

    expect(settingsLocation(locations, 'labels')).toEqual({
      file: join(locations.settings, 'labels.json'),
      copies: join(locations.recovery, 'settings', 'labels'),
    });
  });
});

describe('readSettingsFile', () => {
  it('runs from the file when it passes the schema', async () => {
    const location = await tempLocation();
    await writeJson(location.file, labelsFile('1절'));
    await writeJson(join(location.copies, NEWER_COPY), labelsFile('후렴'));

    const read = await readSettingsFile(location, parseLabels);

    expect(read.data?.labels.map(({name}) => name)).toEqual(['1절']);
    expect(read.problems).toEqual([]);
  });

  it('runs with the defaults, without a problem, when there is no file', async () => {
    const location = await tempLocation();

    expect(await readSettingsFile(location, parseLabels)).toEqual({
      data: null,
      problems: [],
    });
  });

  it('reports the parts of the file that were dropped', async () => {
    const location = await tempLocation();
    await writeJson(location.file, labelsFile('후렴', 'C'));

    const read = await readSettingsFile(location, parseLabels);

    expect(read.data?.labels).toEqual([
      {name: '후렴', color: 'teal', key: null},
    ]);
    expect(read.problems).toEqual([
      expect.objectContaining({
        kind: 'invalid',
        file: location.file,
        field: 'labels.0.key',
      }),
    ]);
  });

  it('runs a broken file from its newest copy and keeps the file as it was', async () => {
    const location = await tempLocation();
    await writeJson(location.file, BROKEN_JSON);
    await writeJson(join(location.copies, OLDER_COPY), labelsFile('1절'));
    await writeJson(join(location.copies, NEWER_COPY), labelsFile('후렴'));

    const read = await readSettingsFile(location, parseLabels);

    expect(read.data?.labels.map(({name}) => name)).toEqual(['후렴']);
    expect(read.problems).toMatchObject([{kind: 'json', file: location.file}]);
    expect(read.problems[0]?.message).toContain(
      `running from the recovery copy ${join(location.copies, NEWER_COPY)}`,
    );
    expect(await readFile(location.file, 'utf8')).toBe(BROKEN_JSON);
  });

  it('passes over a copy that is broken too', async () => {
    const location = await tempLocation();
    await writeJson(location.file, BROKEN_JSON);
    await writeJson(join(location.copies, OLDER_COPY), labelsFile('1절'));
    await writeJson(join(location.copies, NEWER_COPY), BROKEN_JSON);
    await writeJson(join(location.copies, 'notes.txt'), labelsFile('후렴'));

    expect(await namesIn(location)).toEqual(['1절']);
  });

  it('runs with the defaults when no copy is readable, and says so', async () => {
    const location = await tempLocation();
    await writeJson(location.file, {...labelsFile('1절'), labels: 'none'});
    await writeJson(join(location.copies, NEWER_COPY), BROKEN_JSON);

    const read = await readSettingsFile(location, parseLabels);

    expect(read.data).toBeNull();
    expect(read.problems).toMatchObject([{kind: 'invalid', field: 'labels'}]);
    expect(read.problems[0]?.message).toContain('running with the defaults');
  });

  it('reports a copies folder it cannot read and runs with the defaults', async () => {
    const location = await tempLocation();
    await writeJson(location.file, BROKEN_JSON);
    await writeJson(location.copies, 'a file where the folder should be');

    const read = await readSettingsFile(location, parseLabels);

    expect(read.data).toBeNull();
    expect(read.problems).toEqual([
      expect.objectContaining({kind: 'json', file: location.file}),
      expect.objectContaining({kind: 'read', file: location.copies}),
    ]);
  });
});
