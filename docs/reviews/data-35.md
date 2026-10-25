# Review request: data-35

- Team member: data
- Branch: `feat/data/schema-helpers`
- Base: `940739295154b875245e655c046cdaf7654db5b2` (`main`)
- Review range: `9407392...feat/data/schema-helpers`
- Request: `.llp/task.md`, "Insert first, priority (from the lead, 02:45)".
- Proposal inspected: output-23 at `35a3711`, read with `git show`.
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

O6a can now validate its constructed overlay values without importing Valibot
outside the schema layer. `overlayState.ts` exposes these nonthrowing helpers:

| Helper                                | Result value               |
| ------------------------------------- | -------------------------- |
| `parseActiveMessages(value: unknown)` | `readonly ActiveMessage[]` |
| `parseActiveProps(value: unknown)`    | `readonly ActiveProp[]`    |
| `parseNoticePlayback(value: unknown)` | `NoticePlayback`           |

Each returns `Result<value, PayloadError>`, with `ok`/`value` on success and
`error.field`/`error.message` on failure. They reuse the existing schemas, caps,
ID brands, duplicate checks, routing rules, and time validation. Empty active
message/prop lists remain valid; notice playback still requires images and
targets. Callers handle the result before applying state.

The pure notice clock from output's proposal is available at
`@shared/noticeClock`: `noticePosition`, `nextNoticeChange`, and
`MAX_OVERLAY_TIMER_MS`. Its arithmetic is unchanged, with named millisecond
constants. Tests cover exact boundaries, looping and selected start positions,
pause/resume phase, backward clocks, sub-millisecond intervals, single images,
and long intervals. Callers supply validated `NoticePlayback` and clamp
scheduled timer delays with the exported limit, as in output's proposal. The
module imports only a shared type, so both processes can use it without a
main-process import.

`parseServiceItemId` checks unknown view IDs and returns a branded ID or a field
error. `isKeyCode` reuses the existing supported-code schema; it does not
replace the shortcut recorder's reserved-key precedence. The two merged renderer
callers now use these helpers. Production `src/` has no remaining Valibot import
outside `src/shared/schema/` in this branch.

Output owns the consumer updates on `feat/output/overlays`: replace its three
direct parses with the `Result` helpers and import the clock from shared. That
unmerged branch is unchanged by this request. No stored format or IPC changes.

## Changed files

- `src/shared/schema/overlayState.ts`: the three public overlay parse helpers.
- `src/shared/schema/ids.ts`: `parseServiceItemId`.
- `src/shared/schema/shortcuts.ts`: `isKeyCode`.
- `src/shared/schema/schemaHelpers.test.ts`: valid and invalid input, brands,
  field errors, duplicates, list caps, and supported key-code cases.
- `src/shared/noticeClock.ts` and `noticeClock.test.ts`: shared pure clock and
  focused clock tests based on the proposal's behavior.
- `src/renderer/src/state/show.ts`: lead exception, only replace the Valibot
  import and item-ID parsing call. Existing shell tests are unchanged.
- `src/renderer/src/ui/shortcutKeys.ts`: lead exception, only replace the
  Valibot import and key-code predicate call. Existing UI tests are unchanged.
- `docs/reviews/data-35.md`.

## Checks run

| Check                                                      | Result                                          |
| ---------------------------------------------------------- | ----------------------------------------------- |
| `npm run typecheck`                                        | Passed                                          |
| New schema-helper and shared-clock Vitest                  | Two files, 36 tests passed                      |
| Existing overlay, show-state, and shortcut-recorder Vitest | Three files, 68 tests passed                    |
| ESLint on changed TypeScript files                         | Passed                                          |
| Production Valibot-import audit                            | No imports outside the schema folder            |
| `npm run format` and `git diff --check`                    | Passed                                          |
| Rebase onto latest main                                    | Already up to date                              |
| Local full verify                                          | Not run, per lead instruction                   |
| GitHub full verification                                   | Final HEAD URL and result accompany the request |

No app, visible windows, dialogs, soak, memory measurements, or dependency
installs were started. The helpers and clock add no cache, listener, or timer.
New test text is invented.

## Where to look

The parse-helper return signatures match O6a's validated model types. The two
renderer diffs contain only imports and the corresponding helper calls. The
clock is shared arithmetic, without Electron, renderer, or main dependencies.

## Verdicts (recorded by the lead at merge)

- Round 1 (1400389): reviewer (Claude, trial-97) Approve with no findings: no
  production file outside `src/shared/schema/` imports valibot, and the renderer
  has no production import of `src/main/`. Lead Approve, including the two
  lead-exception fixes in `state/show.ts` and `ui/shortcutKeys.ts`. Written by
  the Codex session that took over data's work. Rebased by the lead onto local
  `main` without conflicts.

## Team member's reply

Pending review.
