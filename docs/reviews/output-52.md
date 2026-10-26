# Review request: `output-52`

- Team member: `output`
- Branch: `fix/output/audio-disposal`
- Base, head, review range and GitHub CI: in the request message.
- Scope: M3-O7 audio-window disposal. Started on output-51, then rebased onto
  local main after that request merged.

## What changed and why

The hidden audio window's release read its BrowserWindow's `webContents` getter
again. If the window was already destroyed, the getter threw before recovery was
disposed. The outer exception boundary preserved the rest of shutdown, but
relaunch or cooldown timers remained registered and could reload a dead window.
A listener-removal exception also skipped the next listener and recovery
release.

The window captures its contents once. Cleanup disposes recovery first, checks
the owner and contents before using native contents, and releases each listener
through its own logged exception boundary. The release is installed before
subscriptions so partially completed setup can also be cleaned up. Stop remains
idempotent and live state is unchanged.

This is the next O7 unit that can be checked without native sound. X1c and X2c
still depend on open decisions 25 and 26 and the missing X1a/X2a stored fields.

## Changed files

- `src/main/windows/audio.ts` and its test.
- This review document. Changes outside my paths: none.

## Checks run

- Three new regressions failed before the fix: destroyed owner during quick
  recovery, destroyed owner during cooldown, and a listener-removal exception.
  The fake window now throws on the destroyed-owner getter like Electron.
- Audio-window, mute policy, renderer-recovery and shutdown tests: 54 passed.
- Typecheck, own-file ESLint, formatting and GitHub CI: see request message.
- No local Electron or native window was started. All windows are fakes, and the
  default-mute regressions still pass. No sound was played.

## Quality checklist

- [x] Recovery timers release before fallible native cleanup
- [x] A destroyed window's contents getter is not reread during disposal
- [x] One failing listener removal cannot skip the next cleanup
- [x] No new resource, dependency, contract or cache
- [ ] Exact-head CI verified by lead if the shared API is limited

## Verdicts (recorded by the lead at merge)

- Round 1 (e1ded013): reviewer (Codex) Approve. Lead Approve; the hidden audio
  window's release no longer reads `webContents` from a destroyed window, the
  same class of fault as M3-C2-1, so recovery timers are always disposed. The
  exact-head CI run passed, checked by the lead at merge. Rebased by the lead
  onto local `main` without conflicts; typecheck passes.

## Team member's reply

1.
