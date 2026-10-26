# Review request: `screens-2`

- Team member: `screens`
- Branch: `feat/screens/display-layout`, stacked on `screens-1`
  (`feat/screens/workspace-frame`)
- Base commit (`main`): `4fe8bab3`
- Last commit: see the request line
- Related brief: `docs/briefs/screens.md`

## What changed and why

M3-O1 part 2, first request: the monitor list that the display layout panel
needs. Windows could read only `output.findMonitors()` and the monitor saved in
`screens.json`; the list of connected monitors lived in the main process alone.

- A new read channel `monitors:get` and a change push `monitors:changed`,
  exposed as `window.llp.monitors.get()` and
  `window.llp.monitors.subscribe(listener)`.
- Each monitor carries its number (from 1, left to right, then top to bottom),
  name, bounds in desktop pixels, scale factor, refresh rate in hertz
  (Electron's `Display.displayFrequency`, 0 when unknown), and `hasMainWindow`,
  set on the monitor that holds the control window.
- `DisplayInfo` gains `refreshRate`, and the registry now counts a refresh rate
  change as a monitor change.
- Main answers from `DisplayRegistry` and pushes when its list changes.

## Changed files

- `src/shared/schema/monitors.ts` and test: the schema, the caps, and
  `parseMonitorList`.
- `src/shared/ipc.ts`, `src/shared/testing/fakeLlpApi.ts`,
  `src/preload/index.ts` and test: the channels and the bridge.
- `src/main/displays/monitorList.ts` and test: the conversion from monitors.
- `src/main/outputs/start.ts` and test: the handler wiring.
- Changes outside my paths, all additive:
  - `src/shared/` and `src/preload/` (data's): a new schema, two channels, one
    API part, with valid and invalid tests and caps.
  - `src/main/displays/` and `src/main/outputs/start.ts` (output's): the
    `refreshRate` field and the handler. The output path itself is unchanged.

## Contract

| Item             | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| List cap         | 64 monitors (`MONITOR_LIST_MAX`, the highest monitor number) |
| Name             | At most 200 characters                                       |
| Bounds           | Integer, position within 1,000,000 pixels, size from 1       |
| Scale factor     | Greater than 0, at most 10                                   |
| Refresh rate     | 0 to 1000 hertz                                              |
| Unknown fields   | Dropped                                                      |
| Failed `get`     | The bridge rejects after logging, as `output.getStatus` does |
| Malformed `push` | Dropped after logging, as the other pushes                   |

## Checks run

| Command or test                                           | Result               |
| --------------------------------------------------------- | -------------------- |
| `npm run typecheck`                                       | Passes               |
| `vitest` on displays, start, monitors schema, and preload | Pass                 |
| `npm run format:check`                                    | Passes               |
| GitHub CI                                                 | See the request line |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI run in the request)
- [x] `npm run format:check` passes
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no bypassing type assertions, and no `!`
- [x] Every registered listener is released (the registry subscription and the
      answer stop with the outputs)
- [x] The list is capped
- [x] The output path is unchanged: the new code only reads the registry

## Decisions and open points

1. `hasMainWindow` is computed when the list is read or pushed. Moving the
   control window to another monitor does not push by itself; the next read or
   monitor change brings the new value. The display layout panel reads again
   when it opens.
2. The `refreshRate` of 0 means the system gave none, so the UI shows no rate.

## Shared contract change requests

Additive only; nothing existing changed.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
