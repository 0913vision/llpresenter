import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../test/temp-dir';
import {writeFileAtomic} from './files.mts';
import {readPackageVersion, writePackageVersion} from './package-version.mts';

const manifest = {
  name: 'llpresenter',
  version: '0.2.0',
  private: true,
  scripts: {verify: 'node scripts/verify.mts'},
};

const lockfile = {
  name: 'llpresenter',
  version: '0.2.0',
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': {name: 'llpresenter', version: '0.2.0', license: 'MIT'},
    'node_modules/zustand': {version: '5.0.16'},
  },
};

async function packageFolder(): Promise<string> {
  const root = await makeTempDir();
  await writeFile(join(root, 'package.json'), JSON.stringify(manifest));
  await writeFile(join(root, 'package-lock.json'), JSON.stringify(lockfile));
  return root;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

describe('readPackageVersion', () => {
  it('reads the version from package.json', async () => {
    expect(await readPackageVersion(await packageFolder())).toBe('0.2.0');
  });

  it('fails when package.json has no version', async () => {
    const root = await makeTempDir();
    await writeFile(join(root, 'package.json'), '{"name": "x"}');
    await expect(readPackageVersion(root)).rejects.toThrow(/no version/);
  });
});

describe('writePackageVersion', () => {
  it('sets both versions and keeps every other field', async () => {
    const root = await packageFolder();
    await writePackageVersion(root, '0.3.0');
    expect(await readJson(join(root, 'package.json'))).toEqual({
      ...manifest,
      version: '0.3.0',
    });
    expect(await readJson(join(root, 'package-lock.json'))).toEqual({
      ...lockfile,
      version: '0.3.0',
      packages: {
        ...lockfile.packages,
        '': {...lockfile.packages[''], version: '0.3.0'},
      },
    });
  });

  it('writes JSON as npm does, with a final newline', async () => {
    const root = await packageFolder();
    await writePackageVersion(root, '0.3.0');
    const text = await readFile(join(root, 'package.json'), 'utf8');
    expect(text).toBe(
      `${JSON.stringify({...manifest, version: '0.3.0'}, null, 2)}\n`,
    );
  });
});

describe('writeFileAtomic', () => {
  it('replaces the file and leaves no temporary file behind', async () => {
    const root = await makeTempDir();
    const path = join(root, 'CHANGELOG.md');
    await writeFile(path, 'old\n');
    await writeFileAtomic(path, 'new\n');
    expect(await readFile(path, 'utf8')).toBe('new\n');
    expect(await readdir(root)).toEqual(['CHANGELOG.md']);
  });
});
