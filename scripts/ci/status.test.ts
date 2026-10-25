import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  CI_EXIT_CODES,
  ciExitCode,
  parseLatestRun,
  reportCiStatus,
  type CiRun,
} from './status.mts';

const SHA = 'a'.repeat(40);
const RUN_URL = 'https://github.com/0913vision/llpresenter/actions/runs/123';
const API_RUN = {
  status: 'completed',
  conclusion: 'success',
  head_sha: SHA,
  html_url: RUN_URL,
};
const RUN: CiRun = {
  status: 'completed',
  conclusion: 'success',
  headSha: SHA,
  url: RUN_URL,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('Unexpected fetch')),
  );
});

describe('parseLatestRun', () => {
  it('reads the latest run without falling back to an older success', () => {
    expect(
      parseLatestRun({
        workflow_runs: [
          {...API_RUN, status: 'in_progress', conclusion: null, name: 'CI'},
          API_RUN,
        ],
      }),
    ).toEqual({...RUN, status: 'in_progress', conclusion: null});
  });

  it('returns null when there are no runs', () => {
    expect(parseLatestRun({workflow_runs: []})).toBeNull();
  });

  it.each(
    [
      null,
      [],
      {},
      {workflow_runs: null},
      {workflow_runs: [{}]},
      {workflow_runs: [{...API_RUN, status: 'unknown'}]},
      {workflow_runs: [{...API_RUN, conclusion: 0}]},
      {workflow_runs: [{...API_RUN, conclusion: ''}]},
      {workflow_runs: [{...API_RUN, head_sha: 'main'}]},
      {workflow_runs: [{...API_RUN, html_url: 'not a URL'}]},
    ].map(value => ({value})),
  )('rejects a malformed response ($value)', ({value}) => {
    expect(() => parseLatestRun(value)).toThrow(
      'Invalid GitHub workflow runs response',
    );
  });
});

describe('ciExitCode', () => {
  it('passes only a completed successful run', () => {
    expect(ciExitCode(RUN)).toBe(CI_EXIT_CODES.success);
  });

  it.each([
    'failure',
    'cancelled',
    'timed_out',
    'neutral',
    'skipped',
    'action_required',
    'stale',
    'startup_failure',
    null,
  ])('fails a completed run with conclusion %s', conclusion => {
    expect(ciExitCode({...RUN, conclusion})).toBe(CI_EXIT_CODES.failure);
  });

  it.each([
    'queued',
    'in_progress',
    'waiting',
    'requested',
    'pending',
  ] satisfies Array<CiRun['status']>)(
    'reports %s as pending even with a stale success conclusion',
    status => {
      expect(ciExitCode({...RUN, status})).toBe(CI_EXIT_CODES.pending);
    },
  );
});

describe('reportCiStatus', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('requests only the branch push runs of ci.yml without authorization', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({workflow_runs: [API_RUN]}));
    const branch = 'chore/devops/한글+ci&status';
    expect(await reportCiStatus([branch], request)).toBe(CI_EXIT_CODES.success);
    expect(request).toHaveBeenCalledOnce();
    const [input, options] = request.mock.calls[0] ?? [];
    if (!(input instanceof URL)) throw new Error('Expected a request URL');
    const url = input;
    expect(url.origin).toBe('https://api.github.com');
    expect(url.pathname).toBe(
      '/repos/0913vision/llpresenter/actions/workflows/ci.yml/runs',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      branch,
      event: 'push',
      per_page: '1',
    });
    const headers = new Headers(options?.headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.get('Accept')).toBe('application/vnd.github+json');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(RUN, null, 2));
  });

  it.each([
    [
      {...API_RUN, status: 'in_progress', conclusion: null},
      CI_EXIT_CODES.pending,
    ],
    [{...API_RUN, conclusion: 'failure'}, CI_EXIT_CODES.failure],
    [{...API_RUN, conclusion: 'cancelled'}, CI_EXIT_CODES.failure],
  ])('returns the latest run result (%j)', async (run, code) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({workflow_runs: [run]}));
    expect(await reportCiStatus(['chore/devops/branch-ci'], request)).toBe(
      code,
    );
  });

  it('distinguishes no runs from a passing or pending result', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({workflow_runs: []}));
    expect(await reportCiStatus(['new-branch'], request)).toBe(
      CI_EXIT_CODES.noRun,
    );
    expect(console.log).toHaveBeenCalledWith(
      'No push CI run found for new-branch.',
    );
  });

  it.each([403, 404, 429, 500])(
    'reports an HTTP %s as an API error',
    async status => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({message: 'API error'}, {status}));
      expect(await reportCiStatus(['main'], request)).toBe(CI_EXIT_CODES.error);
      expect(console.error).toHaveBeenCalledWith(
        'Could not read CI status:',
        expect.objectContaining({
          message: `GitHub API returned HTTP ${status}`,
        }),
      );
    },
  );

  it('reports a network error without retrying', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('Offline'));
    expect(await reportCiStatus(['main'], request)).toBe(CI_EXIT_CODES.error);
    expect(request).toHaveBeenCalledOnce();
  });

  it.each([new Response('{'), Response.json({message: 'Not a runs response'})])(
    'reports invalid JSON or schema as an error',
    async response => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response);
      expect(await reportCiStatus(['main'], request)).toBe(CI_EXIT_CODES.error);
    },
  );

  it.each([{args: []}, {args: ['']}, {args: [' ']}, {args: ['main', 'extra']}])(
    'rejects invalid arguments without requesting the API ($args)',
    async ({args}) => {
      const request = vi.fn<typeof fetch>();
      expect(await reportCiStatus(args, request)).toBe(CI_EXIT_CODES.error);
      expect(request).not.toHaveBeenCalled();
    },
  );
});
