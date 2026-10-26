Review range: `feat/spec/service-tree...feat/spec/service-sources`

# Review request: `spec-49`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/service-sources`, stacked on spec-48
  (`feat/spec/service-tree`)
- Base commit: spec-48's head, named in the request message
- Review round: 1
- Task: M3-P4, part 2 of 3 for 새 예배 (P4a): the source lists, the chosen
  source's document, the date and time choices, and the left list
- Code owner: prep for `src/renderer/src/prep/services/` (no prep member; lead
  exception for P4)

## What changed and why

Spec 05 "New service" puts the sources on the left of the dialog: 빈 예배, the
틀 group (name and "항목 9개"), and the 지난 예배 group (name, a date such as
"10월 25일 일요일", and the count). "Importing from another service" uses the
same list without 빈 예배. The bottom bar has 이름, 날짜, and 시간.

- **Lists.** `useSourceLists` reads the 틀 list, the service list, and the
  library's song titles when the dialog opens, and follows the two lists while
  it is open, so a 틀 saved from the dialog shows up. A list main pushes before
  the read answers is newer and stays. A failed read is logged and shows empty
  lists, so the dialog still offers 빈 예배.
- **Chosen source.** `useSourceDocument` reads the 틀 or past service the
  operator picks and gives its name, its time (a 틀's `time`, or the time part
  of the service's date), and its items. 빈 예배 has no name and no items. A
  source that was deleted or couldn't be read is `missing`. The answer is kept
  under its source's key, so a slow read for an earlier choice never shows under
  a later one.
- **Left list.** `SourceList` is ui's inset `ListBox` with 빈 예배 (when asked
  for), a 틀 group, and a 지난 예배 group, newest service first, each with the
  two-line rows the gallery's 새 예배 example shows. A group with no rows is
  left out. An entry without `itemCount` shows no count.
- **Dates.** `serviceDates.ts` writes a local date as `YYYY-MM-DD`, shows it as
  "10월 25일 일요일", and shows a time as "오전 11:00". The date choices are
  today and the next 13 days, plus the chosen date if it is outside them; the
  time choices are the day in 30-minute steps, plus the chosen time if it falls
  between steps.

## Decisions I made (for the lead to confirm)

1. **Lead decision (P4 Q2):** the date control is a select with today and the
   next 13 days, not the calendar spec 05 draws, until the design system has a
   calendar popover. A `TODO(0913vision)` in `serviceDates.ts` points at it.
2. 지난 예배 lists every service, the current one and any dated later included,
   newest first. Spec 05 doesn't limit it, and copying last week's service is
   the common case.

## Changes outside my paths

None.

## Validation

| Command or test                                                                 | Result                 |
| ------------------------------------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                                             | Pass                   |
| `npx --no-install vitest run --no-fsModuleCache src/renderer/src/prep/services` | Pass, 27 tests         |
| `npx --no-install eslint --max-warnings 0 src/renderer/src/prep/services`       | Pass                   |
| `npx --no-install prettier --check src/renderer/src/prep/services`              | Pass                   |
| GitHub CI (`npm run verify`)                                                    | In the request message |

Tests: dates with weekdays, times at midnight, morning, noon, and evening, the
two weeks of dates with a chosen date outside them, and the time steps with a
time between them; the list rows in order with their dates and counts, the
selected row, the reported source of a picked row, and leaving out 빈 예배 and
an empty group; the lists read, followed after a push, a pushed list kept over a
late read, the listeners removed, and a failed read logged; a 틀's name, time,
and items, a past service's time from its date, 빈 예배, no source, a deleted
source, and an earlier read that answers after a later choice.

No Electron process, visible window, soak, or memory measurement was started.
