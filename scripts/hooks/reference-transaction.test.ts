import {spawnSync} from 'node:child_process';
import {chmod, readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {expect, it} from 'vitest';
import {makeTempGitRepo} from '../../test/git-repo';

async function fixture() {
  const repo = await makeTempGitRepo();
  await repo.commit('chore(repo): create a fixture');
  const main = repo.run(['rev-parse', 'refs/heads/main']);
  repo.run(['switch', '--quiet', '-c', 'other']);
  await repo.commit('chore(repo): add another commit');
  const next = repo.run(['rev-parse', 'HEAD']);
  const hook = await readFile(
    resolve('.githooks/reference-transaction'),
    'utf8',
  );
  await repo.write({'.githooks/reference-transaction': hook});
  await chmod(join(repo.path, '.githooks/reference-transaction'), 0o755);
  repo.run(['config', '--local', 'core.hooksPath', '.githooks']);
  const run = (
    args: readonly string[],
    options: {allow?: string | undefined; input?: string} = {},
  ) => {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          ![
            'LLP_MAIN_OK',
            'GIT_DIR',
            'GIT_WORK_TREE',
            'GIT_INDEX_FILE',
          ].includes(key.toUpperCase()),
      ),
    );
    if (options.allow !== undefined) env.LLP_MAIN_OK = options.allow;
    const result = spawnSync('git', args, {
      cwd: repo.path,
      encoding: 'utf8',
      env,
      input: options.input,
    });
    if (result.error) throw result.error;
    return result;
  };
  return {repo, main, next, run};
}

it('rejects a main update unless the lead explicitly enables it', async () => {
  const {repo, main, next, run} = await fixture();
  for (const allow of [undefined, '0', 'true']) {
    const result = run(['update-ref', 'refs/heads/main', next, main], {allow});
    expect(result.status).not.toBe(0);
    expect(result.stderr.split(/\r?\n/)[0]).toBe('Only the lead moves main.');
    expect(repo.run(['rev-parse', 'refs/heads/main'])).toBe(main);
  }
  expect(run(['update-ref', '-d', 'refs/heads/main', main]).status).not.toBe(0);
  expect(repo.run(['rev-parse', 'refs/heads/main'])).toBe(main);
  expect(
    run(['update-ref', 'refs/heads/main', next, main], {allow: '1'}).status,
  ).toBe(0);
  expect(repo.run(['rev-parse', 'refs/heads/main'])).toBe(next);
});

it('rejects an entire mixed transaction including main', async () => {
  const {repo, main, next, run} = await fixture();
  const result = run(['update-ref', '--stdin'], {
    input: `start\ncreate refs/heads/new ${next}\nupdate refs/heads/main ${next} ${main}\nprepare\ncommit\n`,
  });
  expect(result.status).not.toBe(0);
  expect(repo.run(['rev-parse', 'refs/heads/main'])).toBe(main);
  expect(
    run(['show-ref', '--verify', '--quiet', 'refs/heads/new']).status,
  ).not.toBe(0);
});

it('rejects an update through HEAD when it points to main', async () => {
  const {repo, main, next, run} = await fixture();
  expect(run(['switch', '--quiet', 'main']).status).toBe(0);
  expect(run(['update-ref', 'HEAD', next, main]).status).not.toBe(0);
  expect(repo.run(['rev-parse', 'refs/heads/main'])).toBe(main);
});

it('allows other branches, tags and fetched remote-tracking refs', async () => {
  const {repo, main, next, run} = await fixture();
  expect(run(['update-ref', 'refs/heads/main-other', next]).status).toBe(0);
  expect(run(['update-ref', 'refs/tags/main', next]).status).toBe(0);
  expect(
    run(['fetch', '--quiet', '.', 'refs/heads/main:refs/remotes/origin/main'])
      .status,
  ).toBe(0);
  expect(repo.run(['rev-parse', 'refs/remotes/origin/main'])).toBe(main);
  expect(repo.run(['rev-parse', 'refs/heads/main'])).toBe(main);
});
