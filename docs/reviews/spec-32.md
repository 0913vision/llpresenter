Review range: `81cc2b9...feat/spec/song-background-control`

# Review request: `spec-32`

- Team member: `spec`
- Branch: `feat/spec/song-background-control`
- Base commit: `81cc2b9`, main after data-34
- Stack: started on spec-31, then rebased onto main after its approval
- Review round: 1
- Task: `.llp/task.md`, final M3-S1a slide-header control
- Ownership exception: renderer show and shell paths for S1a

## What changed and why

Added the background select beside the existing slide name and position. The
control shows the effective item's override or song default and indicates 곡
기본값 when inherited. The menu offers 곡 기본값 and the installed image and
video choices, excluding audio. Choosing a value delegates to spec-31's
controller and spec-30's revision-checked service edit. Read-only and pending
controls reject activation.

The component composes the existing small Button and Menu with the Select's
media, spacing, and type tokens. Its custom lead can show an image or a paused
video frame through the existing `mediaUrl` protocol. A single muted video does
not autoplay; its source is released on replacement or unmount. Names truncate
with the shared full-name tooltip.

The current value and default status are exposed as the button's accessible
description. The service-name picker also gains ArrowDown opening through the
shared menu-button helper, matching the new background picker.

Missing backgrounds show the amber mark and 배경 파일을 찾을 수 없음 tooltip. As
explicitly directed by the lead, 다시 연결 is unavailable with the tooltip 현재
버전에서는 미디어 파일을 다시 연결할 수 없음. Data-34 supplies reads and
subscriptions; prep's P6a owns enabling the actual relink operation. This
control does not open a native picker or pretend relinking is implemented.

## Integration and remaining work

The control is mounted in the 진행 slide header alongside SlidePanelMeta's
existing item name and live position/count. Problems go through the App-owned
`onProblem` callback into the one notification stack. Data-34's merged media
store supplies document reads and subscriptions.

Service dialogs below the service list remain prep's P4 work, as spec 04 now
says. Actual media relinking remains P6a work. S1b is excluded. Data-35's
protected import in `state/show.ts` is untouched.

## Checks run

| Check                            | Result                                 |
| -------------------------------- | -------------------------------------- |
| Targeted renderer tests          | Pass: 62 tests in 6 files              |
| Renderer TypeScript check        | Pass                                   |
| Changed-file ESLint and Prettier | Pass                                   |
| `git diff --check`               | Pass                                   |
| Workspace integration tests      | Included in the targeted renderer run  |
| Local full verify                | Not run, per the lead's rule           |
| GitHub branch CI                 | Exact submitted HEAD run in the report |

Tests cover image/video choices and inherited state, ArrowDown opening, audio
exclusion, removing an override, paused/muted video and resource release,
read-only and pending states, the missing warning and unavailable reason, and
binding the host and selection callbacks. The workspace regression preserves
position/count, forwards problems, and keeps this control in 진행. The
controller's persistence and output race tests are in spec-31. No Electron
process, visible window, soak, or memory measurement was started.
