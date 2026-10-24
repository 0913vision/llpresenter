# Review request: `data-13`

Review range: `695901b...feat/data/media-library`

Changed outside data's paths, with output's permission: `src/main/index.ts` (the
media placeholders and their TODO are gone; `serveMedia` gets the data store's
lookup, and the shutdown step runs the store's `dispose`) and
`src/main/index.wiring.test.ts` (its `registerStore` mock returns the handle,
and a test checks what `serveMedia` gets).

- Team member: `data`
- Branch: `feat/data/media-library`, stacked on `data-9` (`feat/data/backups`,
  695901b, in review)
- Base commit (`main`): `94780dc`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`; M2 in `docs/MILESTONES.md`;
  `docs/spec/02-data.md`, "Media list"; the lead's store rules (no development
  run touches the user's real data)

What to check:

1.  `src/main/store/mediaLibrary.ts` against spec 02, "Media list": a relative
    `file` lies in the media folder, and an absolute one stays where it is. A
    relative path that leaves the media folder is refused and reported. In
    development, any file outside the media folder is refused, and the media
    folder is the only root.
2.  The roots `serveMedia` checks real paths against: the media folder, plus the
    folder of each item kept outside it.
3.  `src/main/store/register.ts`: `findMediaFile` waits for the launch read and
    never rejects; `mediaRoots` is empty until the data is read; a refused or
    unreadable data folder has no media.
4.  `src/main/index.ts`: `registerStore` runs before `serveMedia`, and the
    shutdown order stays as output set it.

## Shared changes

None. `src/shared/` and `src/preload/` are untouched.

## What changed and why

M2's acceptance and devops' soak test need a looping background from a real
media entry. Output's media protocol (`serveMedia`) was waiting for two
functions from the store: the file of a media id, and the folders media may come
from. This request reads `설정\media.json` and provides both.

| Module            | What it does                                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mediaLibrary.ts` | `buildMediaLibrary`: the file of each item and the roots, with a problem for each refused file. `LoadingMediaLibrary`: a lookup that waits for the launch read, and roots that are empty until then.              |
| `fileStore.ts`    | `LoadedStore.media`. `media.json` is read like the other app-wide settings files, so a broken one runs from its newest readable recovery copy or else an empty list, and is reported (`docs/TECH.md`, "Storage"). |
| `defaults.ts`     | `EMPTY_MEDIA_LIST`, the first-launch media list of spec 02.                                                                                                                                                       |
| `register.ts`     | `registerStore` returns a `DataStore` handle: `dispose`, `findMediaFile`, and `mediaRoots`.                                                                                                                       |
| `index.ts`        | Passes the handle's lookup to `serveMedia` and its `dispose` to the shutdown coordinator.                                                                                                                         |

Safety, in layers:

- The lookup only maps ids that `media.json` lists, so a crafted URL can't name
  a file.
- A relative path is resolved against the media folder and must stay inside it.
- In development, every file must lie in the media folder, which
  `confineLocations` (data-7) has already checked against the real path of
  `LLP_USER_DATA`. So a development run never serves real media.
- `serveMedia` (output) still checks the real path of every file against the
  roots, so a link inside the media folder can't lead out.

## Changed files

- `src/main/store/`: `mediaLibrary.ts` and its test (new), `fileStore.ts` and
  `register.ts` with their tests, `defaults.ts`.
- `src/main/index.ts` and `src/main/index.wiring.test.ts` (output's, with
  permission).
- `docs/reviews/data-13.md` (new).

## Checks run

`npm run verify` on the commit before this document (a64da14), on `main` 94780dc
with `data-9` below it: every step passed (187.8 s, steps at once). Coverage:
`src/main/store/` 96.8% of lines and 92.4% of branches; `mediaLibrary.ts` 100%
of both.

| Command or test                    | Result                       |
| ---------------------------------- | ---------------------------- |
| `npm run typecheck`                | Passed (20.1 s)              |
| `npm run lint`                     | Passed (102.0 s)             |
| `npm run format:check`             | Passed (50.9 s)              |
| `npm test`                         | Passed as `test:coverage`    |
| `npm run build`                    | Passed (11.1 s)              |
| `npm run verify` (from phase 1 on) | Passed: every step (187.8 s) |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema: `media.json`
      goes through `parseMediaList`, and media ids from windows are only looked
      up, never turned into paths.
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: nothing new is registered.
- [x] Caches and lists have size caps: the lookup holds one entry per item of
      `media.json`, and the roots at most one per item.
- [x] An exception in the output path doesn't stop the output: the lookup never
      throws, and a missing id answers `null`, which `serveMedia` turns into
      a 404.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured. A lookup is one
      map read.

## Decisions I made (for the lead to confirm)

1.  The folder of every media item kept outside the media folder is a root in
    production. Spec 02 allows absolute paths, and `serveMedia` needs a root for
    each.
2.  In development, absolute paths inside the media folder still work, and every
    other one is refused and reported, rather than following the location rules
    of `app.json`.
3.  The media list isn't watched yet: a change to `media.json` while the app
    runs takes effect at the next launch. The media library editor will add
    that.

## Where to look

- `src/main/store/mediaLibrary.ts`: `placeFile`.
- `src/main/index.ts`: the `registerStore` and `serveMedia` calls.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (e0716e6): reviewer (Codex, codex3) Approve with one nit: the test
  imports valibot directly (TECH.md keeps it in `src/shared/schema/`); get the
  branded media IDs through a public parser. The nit goes into data's next
  branch. Lead Approve; serveMedia now finds files through the media library,
  with the containment rules of data-7. The `src/main/index.ts` wiring changed
  with output's permission. Rebased by the lead onto local `main` without
  conflicts.

## Team member's reply

1.
