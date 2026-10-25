Review range: `9407392...feat/spec/song-background-edit`

# Review request: `spec-30`

- Team member: `spec`
- Branch: `feat/spec/song-background-edit`, from main
- Base commit: `9407392`
- Review round: 1
- Task: `.llp/task.md`, M3-S1a background selection, persistence slice
- Ownership exception: renderer state for S1a and own spec/review documents

## What changed and why

Added the service-item background edit used by the upcoming slide-header
control. It reads the latest service document, changes only the selected song
item's background override, and submits `service.update` with that document's
revision. Null removes the override so the song default is inherited.

The helper preserves every other item, the song reference and arrangement, memo,
service metadata, and unknown fields. It does not mutate the read document. An
unchanged choice avoids a write. A removed or mismatched service, removed item,
non-song item, or read-only document is refused before an edit.

Main retains authority over revision conflicts and disk writes. Refusals and
`write-failed.applied` results retain their full existing semantics. Rejected
reads and writes return their original message with `request-failed`. The API
accepted by this helper has only service reads and content edits; it cannot send
output commands or change a library song's default.

## Integration boundary

The slide-header control is not mounted by this slice. Its read/subscription
controller and guarded live-media update are staged separately for the next
request, followed by the visual control. These remain assigned S1a work.

As the lead specified, data-34 supplies media-document reads and subscriptions.
Relink remains explicitly unavailable until prep's P6a. After data-34 merges,
the missing-background button will show that state and its reason in a tooltip.
No new shared contract is requested here. `state/show.ts` is untouched: data-35
owns replacing its Valibot import with the shared schema helper.

## Spec-29 nit

Spec 04 and spec-29's review document now explicitly name 새 예배, 다른 예배에서
가져오기, and 지금 예배를 틀로 저장 as remaining work for prep's M3-P4. The
service picker is not described as having completed those three actions.

## Checks run

| Check                            | Result                                                  |
| -------------------------------- | ------------------------------------------------------- |
| Background persistence tests     | Pass: six tests                                         |
| Renderer TypeScript check        | Pass                                                    |
| Changed-file ESLint and Prettier | Pass                                                    |
| `git diff --check`               | Pass                                                    |
| Local full verify                | Not run, per the lead's rule                            |
| GitHub branch CI                 | Exact submitted HEAD's URL and result are in the report |

Tests cover preservation and immutability, fresh revisions, override removal and
no-op choices, read-only and missing documents/items, non-song rows, stale
refusal, applied disk failure, and rejected reads/writes. Fixtures contain
invented data. No Electron process, visible window, soak, or memory measurement
was started. The report records the exact submitted HEAD's green CI result
without adding an unverified metadata commit.
