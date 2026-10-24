import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../test/temp-dir';
import {makeTempGitRepo} from '../../test/git-repo';
import {HOOKS_PATH, installHooks} from './install.mts';

describe('installHooks', {timeout: 60_000}, () => {
  it('points the repository config at the committed hooks', async () => {
    const repo = await makeTempGitRepo();
    expect(installHooks(repo.path)).toBe(true);
    expect(repo.run(['config', '--local', 'core.hooksPath'])).toBe(HOOKS_PATH);
  });

  it('does nothing outside a git checkout', async () => {
    expect(installHooks(await makeTempDir())).toBe(false);
  });
});
