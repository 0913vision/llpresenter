# Review request: data-24

Shared changes: optional `preferences.json` field `show.showClearUndoButton`,
normalized to false, and the typed read-only `preferences.get()` boundary on
`preferences:get`.

- Team member: data
- Branch: `feat/data/clear-undo-preference`
- Stacked on: data-23, `feat/data/library-contracts` at `84150ce`
- Stack base (`main`): `ff36504` (includes devops-19's SwiftShader fix)
- Last code commit: `17c93b4`
- Incremental review range: `84150ce...feat/data/clear-undo-preference`
- Task: the spec-18 prerequisite inserted before M3-D1a-3 (now data-25)
- Exact requested shape: `docs/reviews/spec-18.md` at `75c5ea0`

## What changed and why

The `show` group and its boolean are optional in stored preferences. Missing
file, group, or field means false; explicit true and false are retained.
`withPreferenceDefaults` merges the nested group, preserving its unknown fields
with the same file-key handling as other preference groups. Stored formats and
versions are unchanged.

`preferences.get()` waits for `registerStore`'s existing loading promise and
returns normalized preferences, including the new boolean. It shares the startup
read and does not open a second settings store or writer. A missing or unusable
store returns the existing defaults. Broken preference files still follow the
existing recovery/default behavior and are not overwritten.

Preload validates file-shaped preference replies with `parsePreferencesValue`
and applies the same defaults as main. Malformed booleans or transport failures
are logged and rejected. Unknown file fields survive validation. The fake API
returns defaults, so tests that do not specify this setting start with false.
Disposal removes the new handler.

The read returns the complete normalized `Preferences` value, rather than a
second copy of the boolean in `app.json`. Data-25 can add document editing and
subscriptions alongside this stable method. This request adds no write API,
settings window, clear command, undo availability change, or visibility UI.

## Changed files

- `schema/preferences.ts` and its test: stored field, false default, nested
  merge, validated normalized reply, malformed input, and unknown-field tests.
- `src/shared/ipc.ts` and preload/fake/tests: one typed read and channel.
- `src/main/store/register.ts` and its test: existing-load handler and cleanup;
  early simultaneous reads use one load, explicit values survive, failed loads
  fall back, and broken files stay unchanged.
- This review document. All paths belong to data.

## Checks run

| Check                                                            | Result                                              |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| Typecheck                                                        | Passed, including after the devops-19 stack refresh |
| Preferences, store registration/loading, preload, and fake tests | Passed: 5 files, 101 tests                          |
| Final registration test after fallback assertion                 | Passed: 23 tests                                    |
| Changed-file ESLint                                              | Passed                                              |
| Format                                                           | Passed before the source commit                     |
| Local full verify                                                | Not run, per the updated CI rule                    |
| GitHub CI at `c44f7bc`                                           | Passed: fully green                                 |

Source verification run:
[GitHub CI](https://github.com/0913vision/llpresenter/actions/runs/40190472129).
The final review-head run URL and result are included in the request report.
This stack includes devops-19; the earlier GPU exception no longer applies.
Restacking after the lower review metadata update changed no source files; the
final review-head CI must also be fully green. Fast-check logs use
`.llp/data24-*.log`.

## Quality checklist

- [x] Source CI is fully green; final review-head CI is recorded in the request
      report.
- [x] Defaults, explicit values, invalid values, unknown fields, and the read
      boundary have tests.
- [x] One existing settings load, no new writer or persisted copy.
- [x] Handler lifetime is bounded and tested.
- [x] No unchecked assertions, non-null assertions, or `any`.
- [x] No renderer or output-path changes.

## Decisions for the lead

Return complete normalized preferences through the stable `preferences.get()`
method. Later settings-file document APIs can add revision/access and editing
alongside it without replacing this read or making `ui.get()` own a copy.

---

## Verdicts (recorded by the lead at merge)

- Round 1 (2079d1b): reviewer (Codex, codex3) Approve with no findings. Lead
  Approve: `preferences.get()` returns normalized preferences with
  `show.showClearUndoButton` false by default, the prerequisite for spec-18.
  Written by the Codex session that took over data's work. Rebased by the lead
  onto local `main` after data-23 without conflicts.
