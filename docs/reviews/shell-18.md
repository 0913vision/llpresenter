# Review request: `shell-18`

Review range: 5536536...fix/shell/preview-mode

What to check: that every preview renderer is created with the `preview` mode of
output-12, so a looping background keeps one video instead of two, and that the
test would fail without it.

- Team member: `shell`
- Branch: `fix/shell/preview-mode`
- Base commit (`main`): `5536536`
- Last commit: see the commit that adds this file
- Related brief: bug M2-4 of qa (three previews keep six video decoders)

## What changed and why

`ScreenPreview` created
`new OutputRenderer(screen, {lyricStyle, mediaUrl, onError})` without `mode`, so
each preview behaved like an output window: two loaded videos that hand over at
every loop point. Three previews kept six decoders running next to the output
windows' own. It now passes `mode: 'preview'`, which output-12 added for this: a
looping background keeps one natively looping video, and the second video exists
only during a dissolve.

The renderer's own tests (`backgroundLayer.test.ts`) cover what the mode does.
This change only selects it.

## Changed files

- `src/renderer/src/show/ScreenPreview.tsx`
- `src/renderer/src/show/PreviewPanel.test.tsx` ("mounts every renderer in the
  preview mode, so a looping background keeps one video")

## Checks run

I did not check the video counts in the running app, because that needs a
looping background file. The count of videos in a preview is what
`backgroundLayer.test.ts` asserts for the `preview` mode.

See "Verify result" at the end of this file for `npm run verify`.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Verify result")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (not touched)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (not touched)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (not touched)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- None.

## Shared contract change requests

- None.

## Where to look

- `ScreenPreview.tsx`: the options of the renderer.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Not reviewed yet.
