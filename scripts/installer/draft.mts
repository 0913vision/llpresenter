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
const response = await fetch(
  `https://api.github.com/repos/${repository}/releases/tags/${tag}`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    signal: AbortSignal.timeout(30000),
  },
);
if (response.status !== 404) {
  if (!response.ok) {
    throw new Error(`Could not verify release status (${response.status})`);
  }
  const release: unknown = await response.json();
  if (
    typeof release !== 'object' ||
    release === null ||
    Reflect.get(release, 'draft') !== true
  ) {
    throw new Error(
      'This tag already has a published release; select a new bump tag',
    );
  }
  if (writeNotes) {
    await includeNotes(release);
  }
} else if (writeNotes) {
  throw new Error('The installer upload did not create a draft release');
}
console.log(
  writeNotes
    ? 'The draft includes the font link'
    : 'The release is absent or still a draft',
);

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
