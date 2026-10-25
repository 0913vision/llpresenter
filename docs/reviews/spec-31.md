Review range: `4efee4b...feat/spec/song-background-controller`

# Review request: `spec-31`

- Team member: `spec`
- Branch: `feat/spec/song-background-controller`
- Base commit: `4efee4b`, main after spec-30 and data-35
- Stack: started on spec-30, then rebased onto main after its approval
- Review round: 1
- Task: `.llp/task.md`, M3-S1a slide-header background controller
- Ownership exception: renderer show paths for S1a

## What changed and why

Added the controller behind the upcoming background control. It loads the
selected service song item, its library song, and the media document, retaining
the distinction between an item override and the song's default. Three released
feeds refresh changes to the service, chosen song, and media list. Request
versions and selection guards keep old reads from replacing a newly selected
item. Failed reads keep their cause in logs and report through the host.

Choosing a background uses spec-30's `service.update` helper. Only one choice
can be pending. Refusals preserve current output. An applied disk failure still
refreshes the in-memory projection and reports the save warning. Reloading the
edited document updates the displayed override; no optimistic document copy is
made authoritative.

## Output guards

After an applied edit, the controller reads the refreshed main projection. It
applies that projection only to the still-current service and rejects an older
revision. It sends only `media.show`, and only when the same item is still live,
the command version is unchanged, and the currently playing media has not
changed during the request. The resolved projection must match an explicit
chosen media id. Unresolved backgrounds keep the existing media.

Off-air edits never send output. A service switch, newer output command, or
manual media change prevents late delivery. Existing identical media is kept
without restarting it. No lyrics, item-start, clear, or output-toggle command is
sent. Component state updates and late output stop after unmount; all three
document feeds are released.

## Integration boundary

The visual slide-header control follows in spec-32. This hook is not mounted by
this request. It uses data-34's existing media read/subscription contract; the
lead will announce its merge before the renderer connection is submitted. Relink
stays unavailable with a reason tooltip until prep's P6a, as directed. There are
no shared or main-process edits, and `state/show.ts` remains untouched under
data-35's exception for its schema-helper import.

## Checks run

| Check                                       | Result                                                             |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Controller and background persistence tests | Pass: 12 tests in two files                                        |
| Renderer TypeScript check                   | Pass                                                               |
| Changed-file ESLint and Prettier            | Pass                                                               |
| `git diff --check`                          | Pass                                                               |
| Local full verify                           | Not run, per the lead's rule                                       |
| GitHub branch CI                            | Required after rebasing onto main; URL and result go in the report |

The controller tests cover inherited data, override persistence, live-media-only
delivery, unchanged lyrics, off-air changes, newer manual media and service
switches during refresh, refused writes, stale item reads, and feed cleanup. No
Electron process, visible window, soak, or memory measurement was started.

## Verdicts (recorded by the lead at merge)

- Round 1 (2cc892b): reviewer (Claude, trial-97) Approve with no findings: at
  most one `media.show` for the live item, guarded against service switches,
  other commands from this window, and manual or 매크로 background changes; no
  clear or slide command. Lead Approve. Written by the Codex session that took
  over spec's work, under the lead's exception for shell's paths. Rebased by the
  lead onto local `main` without conflicts.
