Review range: `4bcba7b...feat/spec/service-header`

# Review request: `spec-14`

- Team member: `spec`
- Branch: `feat/spec/service-header`, from `main` (not stacked)
- Base commit (`main`): `4bcba7b`
- Shared files changed: `src/renderer/src/shell/Workspace.tsx` and its tests,
  with the lead's feature-specific ownership exception
- Last commit: the commit that completes this request
- Task: `.llp/task.md`, chosen M2 check 1 service header A

## What changed and why

The current panel header says 예배 순서 while the service name appears only in
the small menu bar title. The user chose alternative A in
`design/drafts/m2-check1/`: the open service name becomes the visible panel
heading at the existing 34px height, with a decorative dropdown arrow.

`ServiceOrderHeader` reads only the open service name from the existing store.
Its component-local type token keeps the chosen 16/22 semibold size when the
separate Windows type-scale change raises general headings to 18/24. Long names
truncate to one line with an ellipsis, and the existing `TruncatedText`
component shows the full name in a tooltip when truncated. With no service open,
the heading says 예배 순서 and has no arrow.

The picker is deferred. The name and arrow are static content, with no button or
menu semantics and no live-state commands. Spec 04 distinguishes the implemented
header from the later service picker.

## Wiring and ownership

The lead authorized `src/renderer/src/show/`, `shell/Workspace.tsx`, and its
tests for this header feature. The workspace's private Panel accepts an optional
header slot, supplied only for the 진행 service-order panel. Its existing 34px
header container, accessible region name 예배 순서, and `ReadOnlyMark` remain in
place. Other workspace headers keep their original content. The shared UI Panel
and global tokens are unchanged.

## Changed files

- `src/renderer/src/show/ServiceOrderHeader.tsx`
- `src/renderer/src/show/ServiceOrderHeader.module.css`
- `src/renderer/src/show/ServiceOrderHeader.test.tsx`
- `src/renderer/src/show/ServiceOrderHeader.layout.test.ts`
- `src/renderer/src/shell/Workspace.tsx`
- `src/renderer/src/shell/Workspace.test.tsx`
- `docs/spec/04-show.md`
- `docs/reviews/spec-14.md`

## Checks run

| Check                  | Result                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Focused renderer tests | Pass: 3 files, 34 tests, 5.45 s; header tests and existing workspace tests                                               |
| Workspace integration  | Pass: six new cases cover all three size classes, no service, read-only warning, and the unchanged 준비 header           |
| `npm run verify`       | Pass once: all 5 steps in 183.8 s on implementation commit 8097bf7 (typecheck, lint, format:check, test:coverage, build) |
| `git diff --check`     | Pass                                                                                                                     |
| Offscreen safety       | LLP_TEST_WINDOWS=offscreen for focused and full verification; no manual app launch                                       |

## Decisions and limits

- The service name is not exposed as an enabled picker before the picker exists.
  Its arrow is decorative.
- The panel keeps its accessible name 예배 순서 and its read-only warning. The
  menu bar keeps the service title.
- No new dependencies, persistence, IPC, output changes, or general type-scale
  changes are part of this request.
