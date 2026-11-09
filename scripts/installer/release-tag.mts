import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const tag = process.env.RELEASE_TAG ?? '';
if (!/^v\d+\.\d+\.\d+$/u.test(tag)) {
  throw new Error('Expected an existing vMAJOR.MINOR.PATCH tag');
}
const git = (...args: string[]): string =>
  execFileSync('git', args, {encoding: 'utf8'}).trim();
const commit = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
if (commit !== git('rev-parse', 'HEAD')) {
  throw new Error('Checkout does not match the existing tag');
}
const pkg: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
if (
  typeof pkg !== 'object' ||
  pkg === null ||
  Reflect.get(pkg, 'version') !== tag.slice(1)
) {
  throw new Error('package.json version does not match the tag');
}
console.log(`Validated existing tag ${tag} at ${commit}`);
