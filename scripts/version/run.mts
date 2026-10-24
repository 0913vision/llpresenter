import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {BumpError, bumpFromCommits, type BumpRequest} from './bump.mts';

const FAILURE_EXIT_CODE = 1;
const USAGE_EXIT_CODE = 2;

const USAGE = [
  'Usage: node scripts/version/run.mts [--major] [--dry-run]',
  "  --major    raise the major version (only with the user's permission)",
  '  --dry-run  print the next version without changing anything',
].join('\n');

/** What the command line asked for, or why it can't be read. */
export type VersionCommand =
  | {readonly kind: 'bump'; readonly request: BumpRequest}
  | {readonly kind: 'usage'; readonly message: string};

function readArgs(args: readonly string[]) {
  try {
    return parseArgs({
      args: [...args],
      strict: true,
      options: {
        major: {type: 'boolean', default: false},
        'dry-run': {type: 'boolean', default: false},
      },
    }).values;
  } catch (error) {
    return error instanceof Error ? error.message : 'bad arguments';
  }
}

/** Reads the command line. Never throws; a bad argument becomes `usage`. */
export function parseVersionArgs(args: readonly string[]): VersionCommand {
  const values = readArgs(args);
  if (typeof values === 'string') {
    return {kind: 'usage', message: `${values}\n${USAGE}`};
  }
  return {
    kind: 'bump',
    request: {
      major: values.major,
      dryRun: values['dry-run'],
    },
  };
}

async function main(): Promise<void> {
  const command = parseVersionArgs(process.argv.slice(2));
  if (command.kind === 'usage') {
    console.error(command.message);
    process.exitCode = USAGE_EXIT_CODE;
    return;
  }
  await bumpFromCommits(command.request, {
    cwd: process.cwd(),
    mayCommit: process.env['GITHUB_ACTIONS'] === 'true',
    print: line => console.log(line),
  });
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    process.exitCode = FAILURE_EXIT_CODE;
    if (error instanceof BumpError) {
      console.error(`version: ${error.message}`);
      return;
    }
    console.error('version: failed:', error);
  });
}
