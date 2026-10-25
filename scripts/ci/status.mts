import {pathToFileURL} from 'node:url';
import * as v from 'valibot';

const API_URL =
  'https://api.github.com/repos/0913vision/llpresenter/actions/workflows/ci.yml/runs';
const REQUEST_TIMEOUT_MS = 15_000;

const runSchema = v.object({
  status: v.picklist([
    'queued',
    'in_progress',
    'completed',
    'waiting',
    'requested',
    'pending',
  ]),
  conclusion: v.nullable(v.pipe(v.string(), v.minLength(1))),
  head_sha: v.pipe(v.string(), v.regex(/^[0-9a-f]{40}$/i)),
  html_url: v.pipe(v.string(), v.url()),
});
const responseSchema = v.object({workflow_runs: v.array(runSchema)});

/** The latest push run of ci.yml for the requested branch. */
export interface CiRun {
  readonly status: v.InferOutput<typeof runSchema>['status'];
  readonly conclusion: string | null;
  readonly headSha: string;
  readonly url: string;
}

/** Exit codes distinguish a result from pending, absent, or unreadable runs. */
export const CI_EXIT_CODES = {
  success: 0,
  failure: 1,
  pending: 2,
  noRun: 3,
  error: 4,
} as const;

/** Validates the API response; an empty run list returns null. */
export function parseLatestRun(value: unknown): CiRun | null {
  const parsed = v.safeParse(responseSchema, value);
  if (!parsed.success) throw new Error('Invalid GitHub workflow runs response');
  const run = parsed.output.workflow_runs[0];
  if (run === undefined) return null;
  return {
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.head_sha,
    url: run.html_url,
  };
}

/** Only a completed, successful run passes. */
export function ciExitCode(run: CiRun): number {
  if (run.status !== 'completed') return CI_EXIT_CODES.pending;
  return run.conclusion === 'success'
    ? CI_EXIT_CODES.success
    : CI_EXIT_CODES.failure;
}

async function fetchLatestRun(
  branch: string,
  request: typeof fetch,
): Promise<CiRun | null> {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({
    branch,
    event: 'push',
    per_page: '1',
  }).toString();
  const response = await request(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'llpresenter-ci-status',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GitHub API returned HTTP ${response.status}`);
  }
  const value: unknown = await response.json();
  return parseLatestRun(value);
}

/** Prints one branch's latest push result without using authentication. */
export async function reportCiStatus(
  args: readonly string[],
  request: typeof fetch = fetch,
): Promise<number> {
  const [branch] = args;
  if (args.length !== 1 || branch === undefined || branch.trim() === '') {
    console.error('Usage: node scripts/ci/status.mts <branch>');
    return CI_EXIT_CODES.error;
  }
  try {
    const run = await fetchLatestRun(branch, request);
    if (run === null) {
      console.log(`No push CI run found for ${branch}.`);
      return CI_EXIT_CODES.noRun;
    }
    console.log(JSON.stringify(run, null, 2));
    return ciExitCode(run);
  } catch (error) {
    console.error('Could not read CI status:', error);
    return CI_EXIT_CODES.error;
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await reportCiStatus(process.argv.slice(2));
}
