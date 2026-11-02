import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {expect, it} from 'vitest';

// NOTE(0913vision): The screens are named 청중 화면, 방송 화면, and 무대 화면
// everywhere (user decision, November 2). The old names must not come back.

const ROOT = join(__dirname, '..', '..');

function filesUnder(folder: string): string[] {
  return readdirSync(folder).flatMap(name => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.(ts|tsx|css|html)$/.test(name) ? [path] : [];
  });
}

it('has no 본 화면 or 방송 자막 left in the source', () => {
  const found = filesUnder(join(ROOT, 'src'))
    .filter(file => /본 화면|방송 자막/.test(readFileSync(file, 'utf8')))
    .map(file => relative(ROOT, file).split(sep).join('/'));
  expect(found).toEqual([]);
});
