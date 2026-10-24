# Review request: `shell-10`

Review range: 6559a9b...refactor/shell/use-store-writer

What to check: that `src/main/uiState/fileIo.ts` now writes through data's
`writeFileAtomically` (`src/main/store/atomicWrite.ts`) and turns its `Result`
back into a rejection, so `UiStateStore` keeps its behavior (a failed write is
logged and kept dirty); that nothing else used the removed
`uiState/atomicWrite.ts`; and that the new `fileIo.test.ts` covers reading and
writing against real files.

- Team member: `shell`
- Branch: `refactor/shell/use-store-writer`
- Base commit (`main`): `6559a9b`
- Last commit: see the commit that adds this file
- Related brief: the lead's note that the app needs one `writeFileAtomic`

## What changed and why

The app had two atomic writers: mine in `src/main/uiState/` (shell-3) and data's
in `src/main/store/` (data-7), which also retries a rename that antivirus holds
up on Windows and uses a unique temporary name. This change removes mine and
writes through data's. `fileIo.write` keeps the contract that `UiStateStore`
expects (it rejects with the reason when the write fails), so the store's
logging, its dirty flag, and the quit flush do not change.

## Changed files

- `src/main/uiState/fileIo.ts` (uses `writeFileAtomically`)
- `src/main/uiState/fileIo.test.ts` (new: read, missing file, write, replace,
  create the folder, and a failing write that keeps the original)
- `src/main/uiState/atomicWrite.ts` and `atomicWrite.test.ts` (removed; data's
  `src/main/store/atomicWrite.test.ts` covers the writer, including the failures
  after the temporary file exists)

## Checks run

`npm run verify` on commit `0abd391` passed all five steps in 288.5 s:
`typecheck`, `lint`, `format:check`, `test:coverage`, and `build`. The rebase
onto `main` 6559a9b afterwards brought other members' changes only.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Checks run")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (not touched)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (nothing new is registered)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (not touched)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- The adapter throws an `Error` with only the writer's message. `UiStateStore`
  already logs the thrown error, and the message names the file.

## Shared contract change requests

- None.

## Where to look

- `fileIo.ts`: the three lines that turn the `Result` into a rejection.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
