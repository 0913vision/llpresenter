import {mkdir, symlink, writeFile} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {realPathInside} from './insideRoots';

describe('realPathInside', () => {
  it('accepts a file in a root or a folder below it', async () => {
    const root = await makeTempDir();
    await mkdir(join(root, 'backgrounds'));
    await writeFile(join(root, 'backgrounds', 'warm.mp4'), 'x');
    const real = await realPathInside(join(root, 'backgrounds', 'warm.mp4'), [
      root,
    ]);
    expect(real).toMatch(/warm\.mp4$/);
  });

  it('refuses a path that climbs out of every root', async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    await writeFile(join(outside, 'secret.txt'), 'x');
    const climbing = join(root, '..', basename(outside), 'secret.txt');
    expect(await realPathInside(climbing, [root])).toBeNull();
  });

  it('refuses a file reached through a junction to another folder', async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    await writeFile(join(outside, 'secret.mp4'), 'x');
    await symlink(outside, join(root, 'linked'), 'junction');
    expect(
      await realPathInside(join(root, 'linked', 'secret.mp4'), [root]),
    ).toBeNull();
  });

  it('refuses the root itself, a missing file, and any file without roots', async () => {
    const root = await makeTempDir();
    await writeFile(join(root, 'a.mp4'), 'x');
    expect(await realPathInside(root, [root])).toBeNull();
    expect(await realPathInside(join(root, 'gone.mp4'), [root])).toBeNull();
    expect(await realPathInside(join(root, 'a.mp4'), [])).toBeNull();
  });
});
