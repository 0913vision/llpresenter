import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {recoveryMarkerRemoved} from '@main/update/recovery';
import {makeTempDir} from '@fixtures/tempDir';

describe('update restart recovery guard', () => {
  it('allows only a missing marker, including after clean shutdown', async () => {
    const folder = await makeTempDir();
    expect(await recoveryMarkerRemoved(folder)).toBe(true);
    await writeFile(join(folder, 'session.lock'), 'quitting');
    expect(await recoveryMarkerRemoved(folder)).toBe(false);
  });
});
