import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const originalArgs = process.argv;
const notes =
  'Install KoPub before the first run: https://www.kopus.org/biz-electronic-font2/';
const request = vi.fn<typeof fetch>();
const draft = (body: string | null = null): Response =>
  Response.json({id: 42, draft: true, body});

beforeEach(() => {
  vi.resetModules();
  request.mockReset();
  vi.stubGlobal('fetch', request);
  vi.stubEnv('GITHUB_ACTIONS', 'true');
  vi.stubEnv('GITHUB_REPOSITORY', 'owner/repository');
  vi.stubEnv('RELEASE_TAG', 'v1.2.3');
  vi.stubEnv('GH_TOKEN', 'fake-workflow-token');
  vi.stubEnv('RELEASE_NOTES', notes);
  process.argv = [...originalArgs, '--write-notes'];
});

afterEach(() => {
  process.argv = originalArgs;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('draft release notes', () => {
  it('appends the font guidance while preserving existing draft text', async () => {
    request.mockResolvedValueOnce(draft('Changes in this version'));
    request.mockResolvedValueOnce(Response.json({}));

    await import('./draft.mts');

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith(
      'https://api.github.com/repos/owner/repository/releases/42',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({body: `Changes in this version\n\n${notes}`}),
      }),
    );
  });

  it('does not duplicate the guidance when a draft workflow is rerun', async () => {
    request.mockResolvedValueOnce(draft(notes));
    await import('./draft.mts');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('refuses to change a release that has already been published', async () => {
    request.mockResolvedValueOnce(Response.json({id: 42, draft: false}));
    await expect(import('./draft.mts')).rejects.toThrow('published release');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('requires the upload to have created a draft before writing notes', async () => {
    request.mockResolvedValueOnce(new Response(null, {status: 404}));
    await expect(import('./draft.mts')).rejects.toThrow(
      'did not create a draft',
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('permits a missing release during the read-only preflight', async () => {
    process.argv = originalArgs;
    request.mockResolvedValueOnce(new Response(null, {status: 404}));
    await import('./draft.mts');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('fails the workflow when GitHub rejects the draft note update', async () => {
    request.mockResolvedValueOnce(draft());
    request.mockResolvedValueOnce(new Response(null, {status: 503}));
    await expect(import('./draft.mts')).rejects.toThrow(
      'update draft notes (503)',
    );
  });
});
