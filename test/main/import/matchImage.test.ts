import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '@fixtures/tempDir';
import {sameImage} from '@main/import/matchImage';

describe('PowerPoint background comparison', () => {
  it('compares exact bytes across chunks and ignores missing media', async () => {
    const dir = await makeTempDir();
    const a = join(dir, 'a.png');
    const b = join(dir, 'b.jpg');
    const c = join(dir, 'c.png');
    const bytes = Buffer.alloc(65537, 42);
    await writeFile(a, bytes);
    await writeFile(b, bytes);
    bytes[65536] = 43;
    await writeFile(c, bytes);
    expect(await sameImage(a, b)).toBe(true);
    expect(await sameImage(a, c)).toBe(false);
    expect(await sameImage(a, join(dir, 'missing'))).toBe(false);
  });
});
