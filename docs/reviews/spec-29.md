Review range: `c2c364d...feat/spec/service-picker`

# Review request: `spec-29`

- Team member: `spec`
- Branch: `feat/spec/service-picker`, from main after data-33
- Base commit: `c2c364d`
- Review round: 1
- Task: `.llp/task.md`, M3-S1a service picker; the lead's data-33 merge message
- Ownership exception: renderer show and shell paths for S1a

## What changed and why

The service name is now a button that opens the existing design-system Menu
below the header, in both workspaces. It keeps the chosen 16/22 name style,
truncation, full-name tooltip, and panel accessible name. Removed the fulfilled
temporary spec 04 note that clicking the title does nothing.

The 300px menu has 검색 and lists services from `services.list`, newest date
first, with Korean month/day text and a check on the current service. Names
filter as typed. Templates are not queried. Read-only services can be opened,
and an installed service can be chosen when none is currently open. Opening and
closing the menu leaves both the current service and output unchanged.

## Switching and races

Selection uses merged data-33's `service.open({serviceId})`, with no renderer
output command. Main owns saving the current service, opening the selected one,
and preserving the live layers. A successful response updates the service
projection. A null response leaves the current service intact and reports 예배
순서를 찾을 수 없음 through the host.

Pending selection excludes duplicate activation while the header stays
focusable, so Menu can return keyboard focus. Choosing the current service
simply closes the menu. If a newer service change arrives while an older open
response is pending, that response cannot replace it. A same-service response
still passes through the existing revision guard. Unmounted headers ignore late
replies.

The list subscribes only while open. A push wins over an older startup read, and
the feed stops on close or unmount. The service-change guard also releases its
store subscription. Read and open failures keep their causes in logs and pass
warnings to App's existing shared notification host; no panel mounts its own
stack. Closing clears the menu's query and entries.

## Integration boundary

M3-P4 owns the 새 예배, 다른 예배에서 가져오기, and 지금 예배를 틀로 저장
dialogs and their actions (`m3-breakdown.md`, P4). This S1a slice implements
service selection. It does not add placeholder dialog actions. P4 can extend the
existing menu when those dialogs land. The slide-panel header is the remaining
S1a follow-up; item start and done states are in spec-28.

## Checks run

| Check                               | Result                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| Picker, header, and workspace tests | Pass: 42 tests in three files                           |
| Renderer TypeScript check           | Pass                                                    |
| Changed-file ESLint and Prettier    | Pass                                                    |
| `git diff --check`                  | Pass                                                    |
| Local full verify                   | Not run, per the lead's rule                            |
| GitHub branch CI                    | Exact submitted HEAD's URL and result are in the report |

Tests cover keyboard opening and Esc focus return, date order and current check,
search, output preservation, unknown ids, read-only and initially closed
services, current selection, stale list reads, newer service pushes, pending
duplicates, failures, and feed cleanup. Existing name and workspace tests remain
green. No Electron process, visible window, soak, or memory measurement was
started.

The branch was rebased onto main containing data-33. The report records the
exact submitted HEAD's green CI URL and result without a new metadata commit.
