Review range: `e84a7c2...feat/spec/show-toolbar`

# Review request: `spec-34`

- Team member: `spec`
- Branch: `feat/spec/show-toolbar`
- Base commit: `e84a7c2`, main after spec-33
- Review round: 1
- Task: `.llp/task.md`, M3-S1b, first part: toolbar Look menu
- Ownership exception: the lead's shell and control paths for S1b

## What changed and why

Replaced the toolbar's hardcoded 평상시 button with a working Look menu. It
reads the Looks through D2's settings document API when opened, subscribes to
changes while open, and sends `look.set` for the chosen id. It uses the shared
ToolbarButton and Menu in both window sizes, including ArrowDown opening, menu
keyboard navigation, Esc dismissal, and focus return. Closing or unmounting
releases the settings subscription. Reopening reads the list again.

The reader ignores unrelated settings pushes and older or equal revisions. A
newer push stays visible over a slower initial read. Read failures and command
transport exceptions log their causes and go through the App-owned problem
callback into its one notification stack. A failed initial read ends the busy
state; reopening the menu retries it. A late failure after closing does not
report a warning into another workspace.

## Live confirmation limit, confirmed by the lead

The current contract has `look.set`, but `live.send` returns void and LiveState
does not yet identify a current Look. O4 has not merged. Unsupported commands
are diagnosed by main's existing log path, with no renderer result channel.

The lead explicitly chose to keep that contract and show a check only for a Look
confirmed by live state. Therefore this part shows no checked item and names the
toolbar button Look. D2's persisted `current` is not used as live confirmation,
including after a settings push. Sending a command never changes the displayed
name or fabricates a check. The tooltip says 현재 버전에서는 Look 적용을 확인할
수 없음. No success notification or settings write is produced.

Binding the name and check to O4's actual live confirmation remains follow-up
work when its contract lands. There is a TODO at that binding point. No new
command result API, shared schema, preload code, or output behavior is added.

## Remaining S1b parts

Toolbar search results on D4, opening a source song without adding a service
item, the media strip, and narrow-window sidebar and 더 보기 behavior follow as
separate requests of about 600 changed lines.

## Checks run

| Check                             | Result                                                |
| --------------------------------- | ----------------------------------------------------- |
| Look menu, toolbar, and App tests | Pass: 21 tests in 3 files                             |
| Renderer TypeScript check         | Pass                                                  |
| Changed-file ESLint and Prettier  | Pass                                                  |
| `git diff --check`                | Pass                                                  |
| Local full verify                 | Not run, per the lead's rule                          |
| GitHub branch CI                  | Exact submitted HEAD run URL and result in the report |

Tests use invented settings and cover the command id, unchanged live state, no
settings write, no check from persisted current or subsequent pushes, slow-read
ordering, subscription release, failure reporting, reopening after a failure,
late failure suppression, the limit tooltip, and the disabled browser-only
button. No Electron process, visible window, soak, or memory run was started.
