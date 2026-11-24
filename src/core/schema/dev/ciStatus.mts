import * as v from 'valibot';

const RUN_STATUSES = [
  'queued',
  'in_progress',
  'completed',
  'waiting',
  'requested',
  'pending',
] as const;

const runSchema = v.object({
  status: v.picklist(RUN_STATUSES),
  conclusion: v.nullable(v.pipe(v.string(), v.minLength(1))),
  head_sha: v.pipe(v.string(), v.regex(/^[0-9a-f]{40}$/i)),
  html_url: v.pipe(v.string(), v.url()),
});
const responseSchema = v.object({workflow_runs: v.array(runSchema)});

/** The latest push run of ci.yml for the requested branch. */
export interface CiRun {
  readonly status: (typeof RUN_STATUSES)[number];
  readonly conclusion: string | null;
  readonly headSha: string;
  readonly url: string;
}

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
