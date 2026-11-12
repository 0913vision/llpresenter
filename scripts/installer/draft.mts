if (process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('Release checks run on GitHub runners only');
}
const tag = process.env.RELEASE_TAG ?? '';
const repository = process.env.GITHUB_REPOSITORY ?? '';
const token = process.env.GH_TOKEN;
const writeNotes = process.argv.includes('--write-notes');
if (
  !/^v\d+\.\d+\.\d+$/u.test(tag) ||
  !/^[\w.-]+\/[\w.-]+$/u.test(repository) ||
  !token
) {
  throw new Error('Missing release workflow inputs');
}
const release = await findRelease();
if (release !== undefined) {
  if (Reflect.get(release, 'draft') !== true) {
    throw new Error(
      'This tag already has a published release; select a new bump tag',
    );
  }
  if (writeNotes) {
    await includeNotes(release);
  }
} else if (writeNotes) {
  throw new Error(
    `The installer upload did not create a draft release for ${tag}`,
  );
}
console.log(
  writeNotes
    ? 'The draft includes the font link'
    : 'The release is absent or still a draft',
);

async function findRelease(): Promise<object | undefined> {
  const endpoint = `https://api.github.com/repos/${repository}/releases`;
  for (let page = `${endpoint}?per_page=100`; ;) {
    const response: Response = await fetch(page, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      throw new Error(`Could not verify release status (${response.status})`);
    }
    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) {
      throw new Error('Could not verify release status (invalid release list)');
    }
    const entries: readonly unknown[] = releases;
    for (const candidate of entries) {
      if (
        typeof candidate === 'object' &&
        candidate !== null &&
        Reflect.get(candidate, 'tag_name') === tag
      ) {
        return candidate;
      }
    }
    const next = response.headers
      .get('link')
      ?.split(',')
      .map(link => /^<([^>]+)>;\s*rel="next"$/u.exec(link.trim()))
      .find(match => match !== null);
    const nextHref = next?.[1];
    if (nextHref === undefined) return undefined;
    const nextPage = new URL(nextHref);
    if (
      nextPage.origin !== 'https://api.github.com' ||
      nextPage.pathname !== new URL(endpoint).pathname
    ) {
      throw new Error('Could not verify release status (invalid next page)');
    }
    page = nextPage.href;
  }
}

async function includeNotes(release: object): Promise<void> {
  const notes = process.env.RELEASE_NOTES?.trim();
  const id: unknown = Reflect.get(release, 'id');
  const body: unknown = Reflect.get(release, 'body');
  if (
    !notes ||
    typeof id !== 'number' ||
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new Error('Missing draft id or release notes');
  }
  const existing = typeof body === 'string' ? body : '';
  if (existing.includes(notes)) return;
  const updated = await fetch(
    `https://api.github.com/repos/${repository}/releases/${id}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: [existing.trim(), notes].filter(Boolean).join('\n\n'),
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!updated.ok) {
    throw new Error(`Could not update draft notes (${updated.status})`);
  }
}
