import {appendFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {git} from '../scripts/git.mts';
import {makeTempDir} from './temp-dir';

/** A throwaway git repository for one test. */
export interface TempGitRepo {
  readonly path: string;
  /** Runs git in the repository and returns its output. */
  run(args: readonly string[]): string;
  /** Writes files, relative to the repository root. */
  write(files: Readonly<Record<string, string>>): Promise<void>;
  /** Writes files, stages everything, and commits; returns the short hash. */
  commit(
    subject: string,
    files?: Readonly<Record<string, string>>,
  ): Promise<string>;
}

// NOTE(0913vision): Local settings only, so the user's global git config
// (signing, line endings) can't change what a test sees. They are appended to
// .git/config in one write because each git call costs about 100 ms on
// Windows.
const LOCAL_CONFIG = [
  '[user]',
  '\tname = Test',
  '\temail = test@example.com',
  '[commit]',
  '\tgpgsign = false',
  '[tag]',
  '\tgpgsign = false',
  '[core]',
  '\tautocrlf = false',
  '',
].join('\n');

/**
 * Creates an empty repository on `main` in a temp folder that is deleted when
 * the test finishes. Call it inside a test or a `beforeEach` hook.
 */
export async function makeTempGitRepo(): Promise<TempGitRepo> {
  const path = await makeTempDir();
  const run = (args: readonly string[]): string => git(path, args);
  run(['init', '--quiet', '--initial-branch=main']);
  await appendFile(join(path, '.git', 'config'), LOCAL_CONFIG);
  const write = async (
    files: Readonly<Record<string, string>>,
  ): Promise<void> => {
    for (const [file, text] of Object.entries(files)) {
      const target = join(path, file);
      await mkdir(dirname(target), {recursive: true});
      await writeFile(target, text);
    }
  };
  const commit = async (
    subject: string,
    files: Readonly<Record<string, string>> = {},
  ): Promise<string> => {
    await write(files);
    run(['add', '--all']);
    run(['commit', '--quiet', '--allow-empty', '-m', subject]);
    return run(['rev-parse', '--short', 'HEAD']);
  };
  return {path, run, write, commit};
}
