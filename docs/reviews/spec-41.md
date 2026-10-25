Review range: `589e7b59...docs/spec/recovery-snapshot`

# Review request: `spec-41`

- Team member: `spec`
- Branch: `docs/spec/recovery-snapshot`
- Base commit: `589e7b59`
- Task: the lead's 06:50 recovery record clarification

## What changed and why

Spec 02 described an output recovery file made mostly from song/Bible references
and active item ids. The lead-approved data-42 contract stores a complete
LiveState snapshot with the current service id instead.

Updated the section heading, file header, and table to llrecovery schema version
1 with savedAt, nullable serviceId, and state. The table shows nested live
layers with captured content, including slide lines, instead of inventing a
separate root reference model. The audio and timer rows now state that output
excludes them before writing, so neither restarts on restore. The existing
no-undo-history rule and other recovery-dialog proposals stay as written.

Checked the contract and request on the read-only feat/data/recovery-record
branch, including its nullable service id and reuse of LiveState. This request
changes no recovery implementation or restore eligibility behavior.

## Changed files

- `docs/spec/02-data.md`: recovery snapshot section and table.
- `docs/reviews/spec-41.md`: this request.

## Changes outside my paths

None.

## Validation

- Scoped Prettier and `git diff --check` results accompany the final request.
- No runtime code changes; no local test suite or full verify is run.
- Final pushed HEAD and its successful GitHub CI URL accompany the request.
