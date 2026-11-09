import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';

const base = process.argv[2];
if (!base) throw new Error('Expected the comparison base');
const git = (...args: string[]): string =>
  execFileSync('git', args, {encoding: 'utf8'}).trim();
const paths = git('diff', '--name-only', base, 'HEAD').split('\n');
const direct =
  /^(?:electron-builder\.|build\/|scripts\/installer\/|\.github\/workflows\/release\.yml$|src\/(?:main\/update\/|contracts\/ipc\/update\.ts$|preload\/update\.ts$|core\/schema\/update\.ts$|renderer\/src\/app\/update\/))/u;
let changed = paths.some(path => direct.test(path));
if (!changed && paths.includes('package.json')) {
  const fields = (ref: string): string => {
    const value: unknown = JSON.parse(git('show', `${ref}:package.json`));
    if (typeof value !== 'object' || value === null) {
      throw new Error('Invalid package');
    }
    return JSON.stringify(
      [
        'build',
        'dependencies',
        'devDependencies',
        'overrides',
        'main',
        'scripts',
      ].map((key): unknown => Reflect.get(value, key)),
    );
  };
  changed = fields(base) !== fields('HEAD');
}
const output = process.env.GITHUB_OUTPUT;
if (!output) throw new Error('Expected GITHUB_OUTPUT');
appendFileSync(output, `installer=${changed}\n`);
